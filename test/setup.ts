import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  // Reset the datastream base URL override that some tests set.
  vi.clearAllMocks();
});

afterAll(() => server.close());

// jsdom lacks matchMedia (MUI touches it) and getBoundingClientRect returns
// zeros — fine for the portal-position logic under test.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// URL.createObjectURL / revokeObjectURL are used by the download helpers.
if (!('createObjectURL' in URL)) {
  // @ts-expect-error test shim
  URL.createObjectURL = vi.fn(() => 'blob:mock');
}
if (!('revokeObjectURL' in URL)) {
  // @ts-expect-error test shim
  URL.revokeObjectURL = vi.fn();
}
