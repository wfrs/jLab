/**
 * Jest setup file
 * Runs before all tests
 */

import '@testing-library/jest-dom';

// Set environment variables for tests
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = ':memory:';
}
if (!process.env.API_LOG_LEVEL) {
  process.env.API_LOG_LEVEL = 'error';
}

// Suppress console output during tests unless explicitly needed
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') || args[0].includes('Not implemented'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
