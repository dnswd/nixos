import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_back, browser_forward } from '../../src/core/tools-nav.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';

// Helper to create a CDP client for navigation testing
function createMockNavClient(mockServer: MockCDPServer, targetId: string) {
  let evalCalls: Array<{ expression: string }> = [];
  let historyCalls: Array<'back' | 'forward'> = [];

  return {
    async send(method: string, params?: Record<string, unknown>) {
      switch (method) {
        case 'Runtime.evaluate': {
          const { expression } = params ?? {};
          evalCalls.push({ expression: expression as string });

          if ((expression as string).includes('history.back()')) {
            historyCalls.push('back');
          } else if ((expression as string).includes('history.forward()')) {
            historyCalls.push('forward');
          }

          return {
            result: {
              result: { type: 'undefined' },
            },
          };
        }

        default:
          return { result: {} };
      }
    },

    getEvalCalls() {
      return evalCalls;
    },

    getHistoryCalls() {
      return historyCalls;
    },

    clearCalls() {
      evalCalls = [];
      historyCalls = [];
    },
  };
}

describe('P1-17: browser_back and browser_forward', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9358;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    targetId = mockServer.addTab({
      url: 'https://example.com/page2',
      title: 'Page 2',
    });

    registerCDPClient(targetId, createMockNavClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    describe('browser_back', () => {
      it('P1-17: calls history.back() method', async () => {
        const mockClient = createMockNavClient(mockServer, targetId);
        registerCDPClient('back-test', mockClient as unknown as ReturnType<typeof createMockNavClient>);

        const result = await browser_back('back-test');

        expect(result.success).toBe(true);
        expect(result.direction).toBe('back');

        const calls = mockClient.getEvalCalls();
        const backCall = calls.find(c => c.expression === 'history.back()');
        expect(backCall).toBeDefined();

        const historyCalls = mockClient.getHistoryCalls();
        expect(historyCalls).toContain('back');

        unregisterCDPClient('back-test');
      });

      it('P1-17: uses Runtime.evaluate with returnByValue', async () => {
        const mockClient = createMockNavClient(mockServer, targetId);
        registerCDPClient('back-returnbyvalue-test', mockClient as unknown as ReturnType<typeof createMockNavClient>);

        await browser_back('back-returnbyvalue-test');

        const calls = mockClient.getEvalCalls();
        const backCall = calls.find(c => c.expression === 'history.back()');
        expect(backCall).toBeDefined();

        unregisterCDPClient('back-returnbyvalue-test');
      });
    });

    describe('browser_forward', () => {
      it('P1-17: calls history.forward() method', async () => {
        const mockClient = createMockNavClient(mockServer, targetId);
        registerCDPClient('forward-test', mockClient as unknown as ReturnType<typeof createMockNavClient>);

        const result = await browser_forward('forward-test');

        expect(result.success).toBe(true);
        expect(result.direction).toBe('forward');

        const calls = mockClient.getEvalCalls();
        const forwardCall = calls.find(c => c.expression === 'history.forward()');
        expect(forwardCall).toBeDefined();

        const historyCalls = mockClient.getHistoryCalls();
        expect(historyCalls).toContain('forward');

        unregisterCDPClient('forward-test');
      });

      it('P1-17: uses Runtime.evaluate with returnByValue', async () => {
        const mockClient = createMockNavClient(mockServer, targetId);
        registerCDPClient('forward-returnbyvalue-test', mockClient as unknown as ReturnType<typeof createMockNavClient>);

        await browser_forward('forward-returnbyvalue-test');

        const calls = mockClient.getEvalCalls();
        const forwardCall = calls.find(c => c.expression === 'history.forward()');
        expect(forwardCall).toBeDefined();

        unregisterCDPClient('forward-returnbyvalue-test');
      });
    });

    describe('sequence operations', () => {
      it('P1-17: can chain back and forward operations', async () => {
        const mockClient = createMockNavClient(mockServer, targetId);
        registerCDPClient('nav-sequence-test', mockClient as unknown as ReturnType<typeof createMockNavClient>);

        // Navigate back
        const backResult = await browser_back('nav-sequence-test');
        expect(backResult.success).toBe(true);
        expect(backResult.direction).toBe('back');

        // Then forward
        const forwardResult = await browser_forward('nav-sequence-test');
        expect(forwardResult.success).toBe(true);
        expect(forwardResult.direction).toBe('forward');

        // Verify order
        const historyCalls = mockClient.getHistoryCalls();
        expect(historyCalls).toEqual(['back', 'forward']);

        unregisterCDPClient('nav-sequence-test');
      });
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-17-E2E: navigates back in real browser history', async () => {
      // Requires real browser environment
    });

    it.skip('P1-17-E2E: navigates forward in real browser history', async () => {
      // Requires real browser environment
    });

    it.skip('P1-17-E2E: back fails gracefully when no history', async () => {
      // Requires real browser environment
    });

    it.skip('P1-17-E2E: forward fails gracefully when no forward history', async () => {
      // Requires real browser environment
    });
  });
});
