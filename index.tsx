import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { ScriptProvider } from './context/ScriptContext';
import { SlavkoProtocolProvider } from './context/SlavkoProtocolContext';
import { ProjectProvider } from './context/ProjectContext';
import { ToastProvider } from './context/ToastContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ScriptProvider>
        <ProjectProvider>
          <SlavkoProtocolProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </SlavkoProtocolProvider>
        </ProjectProvider>
      </ScriptProvider>
    </ThemeProvider>
  </React.StrictMode>
);