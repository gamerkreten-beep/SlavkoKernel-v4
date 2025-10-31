/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: [
    '**/components/**/*.test.tsx',
    '**/hooks/**/*.test.ts',
    '**/services/**/*.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.frontend.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/cli/',
    // Exclude CLI tests which have their own config
    'cli/src/auth/__tests__/AuthService.test.ts',
    'cli/src/auth/__tests__/SecureStorage.test.ts',
    'cli/src/commands/__tests__/AuthCommand.integration.test.ts',
    'cli/src/commands/__tests__/BatchCommand.test.ts',
    'cli/src/commands/__tests__/CiCommand.test.ts',
    'cli/src/commands/__tests__/CleanupCommand.test.ts',
    'cli/src/commands/__tests__/CompletionCommand.test.ts',
    'cli/src/commands/__tests__/ConfigCommand.test.ts',
    'cli/src/commands/__tests__/DeployCommand.test.ts',
    'cli/src/commands/__tests__/GitCommand.test.ts',
    'cli/src/commands/__tests__/NewCommand.test.ts',
    'cli/src/core/__tests__/BatchService.test.ts',
    'cli/src/core/__tests__/CiService.test.ts',
    'cli/src/core/__tests__/ConfigService.test.ts',
    'cli/src/core/__tests__/DeploymentService.test.ts',
    'cli/src/core/__tests__/GitService.test.ts',
    'cli/src/core/__tests__/ReportService.test.ts',
    'cli/src/core/__tests__/TemplateService.test.ts',
  ],
};