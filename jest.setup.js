// Mute console logs in tests to keep the output clean,
// but provide a way to check if they were called.
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.exit to prevent tests from terminating the process.
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
  // throw new Error(`process.exit called with code ${code}`);
});

beforeEach(() => {
  // Clear all mocks before each test
  mockExit.mockClear();
  Object.values(global.console).forEach(method => {
    if (jest.isMockFunction(method)) {
      method.mockClear();
    }
  });
});