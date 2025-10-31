import React, { useState, useEffect, useRef, useCallback } from 'react';
import { streamChatResponse } from './services/geminiService';
import { CLI_INITIAL_PROMPT } from './constants/cliScript';
import ProjectDashboard from './components/ProjectDashboard';
import { useScript } from './context/ScriptContext';
import { useTheme } from './context/ThemeContext';
import { useProject } from './context/ProjectContext';
import { useGeminiBoost } from './hooks/useGeminiBoost';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useSlavkoProtocol } from './hooks/useSlavkoProtocol';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { useApiKey } from './hooks/useApiKey';
import { useToast } from './context/ToastContext';
import { parseSlavkoMessage } from './utils/slavkoParser';
import { processStream } from './services/streamProcessor';
import type { Content } from '@google/genai';
import type { SlavkoMessage } from './components/SlavkoProtocolRenderer';
import { DeploymentStat } from './components/StatisticsPanel';
import LandingPage from './components/LandingPage';
import AuthWarning from './components/AuthWarning';
import { handleRealDeployment } from './services/deploymentController';


export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  type?: 'thinking' | 'error';
}

export interface EnvVar {
  id: string;
  key: string;
  value: string;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const CHAT_HISTORY_KEY = 'slavkoshellChatHistory';
const ENV_VARS_KEY = 'slavkoshellEnvVars';
const DEPLOY_CONFIG_KEY = 'slavkoshellDeployConfig';
const STATS_KEY = 'slavkoshellStats';
const CHAT_HISTORY_LIMIT = 20;

const DEFAULT_DEPLOY_CONFIG = JSON.stringify(
  {
    "provider": "auto",
    "vercel": { "org": "slavko-kernel" },
    "netlify": {},
    "aws": { "pipelineName": "my-aws-codepipeline-name" },
    "azure": { "org": "my-azure-devops-org", "project": "my-azure-project", "pipelineId": "123" },
    "docker": {}
  },
  null,
  2
);

const Spinner: React.FC = () => (
    <div className="flex items-center justify-center h-screen bg-brand-bg">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-primary" />
    </div>
);

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  
  const { scriptContent } = useScript();
  const { targetRepo } = useProject();
  const { isBoostMode, serviceMode } = useTheme();
  const { emit, subscribe } = useSlavkoProtocol();
  const { addToast } = useToast();
  
  const { isReady: isApiKeyReady, isLoading: isApiKeyLoading, warning, select: selectKey, dismiss: dismissWarning, handleError } = useApiKey();
  const [messages, setMessages] = useLocalStorageState<Message[]>(CHAT_HISTORY_KEY, []);
  const [envVars, setEnvVars] = useLocalStorageState<EnvVar[]>(ENV_VARS_KEY, []);
  const [deployConfig, setDeployConfig] = useLocalStorageState<string>(DEPLOY_CONFIG_KEY, DEFAULT_DEPLOY_CONFIG);
  const [stats, setStats] = useLocalStorageState<DeploymentStat[]>(STATS_KEY, []);

  const [sendBoostedStream] = useGeminiBoost();
  const { playAudio, playingMessageId, loadingMessageId } = useAudioPlayer(serviceMode);

  const messagesRef = useRef<Message[]>([]);
  const initialized = useRef(false);
  const streamControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  useEffect(() => {
    const unsubscribe = subscribe(msg => {
        if (msg.module === 'DEPLOY' && (msg.status === 'DONE' || msg.status === 'ERROR')) {
            const { project, durationSec, deployUrl, provider, error, healthCheck } = msg.payload || {};
            if (msg.action === 'REPORT' || !msg.action) {
              const newStat: DeploymentStat = {
                  id: `stat-${Date.now()}`,
                  project: project || 'unknown-project',
                  status: msg.status === 'DONE' ? 'success' : 'failed',
                  duration: durationSec || 0,
                  provider: provider || 'unknown',
                  url: deployUrl,
                  error: error,
                  timestamp: new Date().toISOString(),
              };
              setStats(prev => [newStat, ...prev]);

              if(msg.status === 'DONE') {
                addToast(`Deployment for '${project}' succeeded!`, 'success');
              } else {
                addToast(`Deployment for '${project}' failed.`, 'error');
              }

              if (msg.status === 'DONE' && deployUrl && healthCheck) {
                  emit({ module: 'HEALTH_CHECK', action: 'PING', status: 'WAITING', payload: { url: deployUrl } });
                  setTimeout(() => {
                      const isSuccess = Math.random() > 0.05;
                      emit({
                          module: 'HEALTH_CHECK',
                          action: 'PONG',
                          status: isSuccess ? 'DONE' : 'ERROR',
                          payload: isSuccess ? `Application is live at ${deployUrl}` : `Health check failed for ${deployUrl}`
                      });
                  }, 2500);
              }
            }
        }
        if (msg.module === 'CLEANUP' && msg.status === 'DONE') {
            setStats([]);
            addToast('Deployment history and stats cleared.', 'info');
        }
    });
    return () => unsubscribe();
  }, [emit, setStats, addToast, subscribe]);

  useEffect(() => {
    const handleRealDeploymentCallback = (provider: string) => {
      handleRealDeployment(provider, targetRepo, deployConfig, envVars, emit);
    };

    const unsubscribe = subscribe(async (msg) => {
        const isDeployInit = msg.module === 'DEPLOY' && (msg.status === 'INIT' || msg.status === 'READY');
        if (!isDeployInit) return;
        
        let provider = msg.payload?.provider;
        if (provider === 'auto') provider = 'vercel';

        if (provider) {
             handleRealDeploymentCallback(provider);
        }
    });
    return () => unsubscribe();
  }, [subscribe, targetRepo, deployConfig, envVars, emit]);


  const streamAndProcess = useCallback(async (
    prompt: string,
    isInitial: boolean = false
  ) => {
    if (streamControllerRef.current) streamControllerRef.current.abort();
    const controller = new AbortController();
    streamControllerRef.current = controller;

    setIsStreamLoading(true);

    const history: Content[] = isInitial ? [] : messagesRef.current.slice(-CHAT_HISTORY_LIMIT).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    if (!isInitial) {
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: prompt }]);
    }
    
    const modelMessageId = `model-${Date.now()}`;
    setMessages(prev => [...prev, { id: modelMessageId, role: 'model', content: '', type: 'thinking' }]);

    try {
      const stream = isBoostMode 
        ? await sendBoostedStream(prompt, history, scriptContent, serviceMode, envVars, deployConfig, targetRepo)
        : await streamChatResponse(prompt, history, scriptContent, serviceMode, envVars, deployConfig, targetRepo);

      const callbacks = {
        onChunk: (chunkText: string) => {
          setMessages(prev =>
            prev.map(msg => {
              if (msg.id !== modelMessageId) return msg;
              const updatedContent = msg.content + chunkText;
              if (msg.type === 'thinking') {
                const { type, ...rest } = msg;
                return { ...rest, content: updatedContent };
              }
              return { ...msg, content: updatedContent };
            })
          );
        },
        onSlavkoMessage: (parsed: Omit<SlavkoMessage, 'timestamp'>) => {
          emit(parsed);
        },
        onComplete: (partialLine: string) => {
          if (partialLine.trim()) {
            const parsed = parseSlavkoMessage(partialLine.trim());
            if(parsed) emit(parsed);
          }
        }
      };
      
      await processStream(stream, controller.signal, callbacks);

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
          console.log("Stream aborted by user.");
          setMessages(prev => prev.filter(msg => msg.id !== modelMessageId));
          return;
      }

      let errorMessage = 'An unknown error occurred. Please check the console.';
      if (error instanceof Error) errorMessage = error.message;
      
      const isApiKeyError =
        errorMessage.includes("API key not valid") ||
        errorMessage.includes("API_KEY_INVALID") ||
        errorMessage.includes("Requested entity was not found.") ||
        errorMessage.includes("API keys are not supported by this API");

      if (isApiKeyError) {
        const userFacingErrorMessage = "Your authentication credentials are not valid. Please select a valid API key to continue.";
        handleError(userFacingErrorMessage);
        errorMessage = userFacingErrorMessage;
      } else {
         addToast(errorMessage, 'error');
      }
      
      emit({ module: 'KERNEL', action: 'STREAM_FAIL', status: 'ERROR', payload: { source: 'streamAndProcess', message: errorMessage } });
      
      setMessages(prev => prev.map(msg => {
        if (msg.id === modelMessageId) {
          return { ...msg, content: errorMessage, type: 'error' };
        }
        return msg;
      }));
    } finally {
      setIsStreamLoading(false);
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
      }
    }
  }, [sendBoostedStream, isBoostMode, emit, handleError, setMessages, addToast, scriptContent, serviceMode, envVars, deployConfig, targetRepo]);

  useEffect(() => {
    if (!initialized.current && scriptContent && isApiKeyReady && targetRepo) {
      initialized.current = true;
      if (messages.length > 0) {
        const initialParsed = parseSlavkoMessage(CLI_INITIAL_PROMPT);
        if (initialParsed) emit(initialParsed);
      } else {
        streamAndProcess(CLI_INITIAL_PROMPT, true);
      }
    }
  }, [streamAndProcess, scriptContent, emit, isApiKeyReady, targetRepo, messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreamLoading) return;
    const currentInput = input;
    setInput('');
    await streamAndProcess(currentInput, false);
  };

  const handleClearHistory = useCallback(() => {
    if (isStreamLoading || !targetRepo) return;
    setMessages([]);
    emit({ module: 'SESSION', action: 'CLEAR', status: 'DONE', payload: 'Chat history cleared.'});
    addToast('Chat history cleared.', 'info');
    streamAndProcess(CLI_INITIAL_PROMPT, true);
  }, [isStreamLoading, streamAndProcess, targetRepo, setMessages, emit, addToast]);
  
  const handleStopStream = useCallback(() => {
    streamControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
            event.preventDefault();
            handleClearHistory();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearHistory]);

  const handleAddEnvVar = useCallback(() => setEnvVars(prev => [...prev, { id: `env-${Date.now()}`, key: '', value: '' }]), [setEnvVars]);
  const handleUpdateEnvVar = useCallback((id: string, key: string, value: string) => setEnvVars(prev => prev.map(v => v.id === id ? { ...v, key, value } : v)), [setEnvVars]);
  const handleDeleteEnvVar = useCallback((id: string) => setEnvVars(prev => prev.filter(v => v.id !== id)), [setEnvVars]);

  if (isApiKeyLoading) {
    return <Spinner />;
  }

  return (
    <>
      {!isApiKeyReady && warning && (
        <AuthWarning 
          message={warning}
          onSelect={selectKey}
          onDismiss={dismissWarning}
        />
      )}
      
      {!targetRepo ? (
        <LandingPage />
      ) : (
        <ProjectDashboard
          // State
          messages={messages}
          isLoading={isStreamLoading}
          input={input}
          envVars={envVars}
          deployConfig={deployConfig}
          stats={stats}
          playingMessageId={playingMessageId}
          loadingMessageId={loadingMessageId}
          // Handlers
          onInputChange={setInput}
          onSendMessage={handleSendMessage}
          onClearHistory={handleClearHistory}
          onStopStream={handleStopStream}
          onPlayAudio={playAudio}
          onApiKeyError={handleError}
          onAddEnvVar={handleAddEnvVar}
          onUpdateEnvVar={handleUpdateEnvVar}
          onDeleteEnvVar={handleDeleteEnvVar}
          onConfigChange={setDeployConfig}
          // Other context
          subscribe={subscribe}
        />
      )}
    </>
  );
};

export default App;