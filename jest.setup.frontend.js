// This file is used to set up the testing environment for Jest.
// It automatically extends Jest's `expect` with matchers for testing DOM nodes.
import '@testing-library/jest-dom';

// Mocks for browser APIs that might not be available in JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
