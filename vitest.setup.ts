// vitest.setup.ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';

// Global msw server for all tests. Individual tests add handlers via server.use()
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
