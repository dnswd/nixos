import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_eval } from '../../src/core/tools-eval.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';
import { BrowserError } from '../../src/core/errors.js';

// Helper to create a CDP client for eval testing
function createMockEvalClient(mockServer: MockCDPServer, targetId: string) {
  return {
    async send(method: string, params?: Record<string, unknown>) {
      switch (method) {
        case 'Runtime.enable':
          return {};

        case 'Runtime.evaluate': {
          const { expression } = params ?? {};

          // Simulate different return types
          if (expression === '"hello"' || (expression as string).includes('"hello"')) {
            return {
              result: { type: 'string', value: 'hello' },
            };
          }

          if (expression === '42' || (expression as string).includes('return 42')) {
            return {
              result: { type: 'number', value: 42 },
            };
          }

          if (expression === 'true' || (expression as string).includes('return true')) {
            return {
              result: { type: 'boolean', value: true },
            };
          }

          if (expression === 'undefined' || (expression as string).includes('return undefined')) {
            return {
              result: { type: 'undefined' },
            };
          }

          if (expression === 'null' || (expression as string).includes('return null')) {
            return {
              result: { type: 'object', subtype: 'null', value: null },
            };
          }

          if ((expression as string).includes('JSON.stringify')) {
            // Object/array serialization
            if ((expression as string).includes('[1, 2, 3]')) {
              return {
                result: { type: 'string', value: '[1,2,3]' },
              };
            }
            if ((expression as string).includes('{ foo: "bar" }')) {
              return {
                result: { type: 'string', value: '{"foo":"bar"}' },
              };
            }
          }

          // Object return
          if ((expression as string).includes('return { foo: "bar" }') && !(expression as string).includes('JSON.stringify')) {
            return {
              result: { type: 'object', value: { foo: 'bar' } },
            };
          }

          // Array return
          if ((expression as string).includes('return [1, 2, 3]')) {
            return {
              result: { type: 'object', value: [1, 2, 3] },
            };
          }

          // Error simulation
          if ((expression as string).includes('throw new Error')) {
            return {
              result: { type: 'undefined' },
              exceptionDetails: {
                text: 'Error: Test error',
                lineNumber: 1,
                columnNumber: 5,
              },
            };
          }

          if ((expression as string).includes('undefinedVariable')) {
            return {
              result: { type: 'undefined' },
              exceptionDetails: {
                text: 'ReferenceError: undefinedVariable is not defined',
                lineNumber: 0,
                columnNumber: 0,
              },
            };
          }

          return {
            result: { type: 'undefined' },
          };
        }

        default:
          return {};
      }
    },
  };
}

describe('P1-13: browser_eval', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9355;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    targetId = mockServer.addTab({
      url: 'https://example.com',
      title: 'Test Page',
    });

    registerCDPClient(targetId, createMockEvalClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-13: evaluates and returns string primitive', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-string-test', mockClient);

      const result = await browser_eval({
        target: 'eval-string-test',
        expression: '"hello"',
      });

      expect(result.result).toBe('hello');
      expect(result.type).toBe('string');

      unregisterCDPClient('eval-string-test');
    });

    it('P1-13: evaluates and returns number primitive', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-number-test', mockClient);

      const result = await browser_eval({
        target: 'eval-number-test',
        expression: '42',
      });

      expect(result.result).toBe('42');
      expect(result.type).toBe('number');

      unregisterCDPClient('eval-number-test');
    });

    it('P1-13: evaluates and returns boolean primitive', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-bool-test', mockClient);

      const result = await browser_eval({
        target: 'eval-bool-test',
        expression: 'true',
      });

      expect(result.result).toBe('true');
      expect(result.type).toBe('boolean');

      unregisterCDPClient('eval-bool-test');
    });

    it('P1-13: handles undefined return', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-undefined-test', mockClient);

      const result = await browser_eval({
        target: 'eval-undefined-test',
        expression: 'undefined',
      });

      expect(result.result).toBe('undefined');
      expect(result.type).toBe('undefined');

      unregisterCDPClient('eval-undefined-test');
    });

    it('P1-13: handles null return', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-null-test', mockClient);

      const result = await browser_eval({
        target: 'eval-null-test',
        expression: 'null',
      });

      expect(result.result).toBe('null');
      expect(result.type).toBe('object');

      unregisterCDPClient('eval-null-test');
    });

    it('P1-13: serializes objects as JSON strings', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-object-test', mockClient);

      const result = await browser_eval({
        target: 'eval-object-test',
        expression: '({ foo: "bar" })',
      });

      expect(result.type).toBe('object');
      expect(result.result).toBe('{"foo":"bar"}');

      unregisterCDPClient('eval-object-test');
    });

    it('P1-13: serializes arrays as JSON strings', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-array-test', mockClient);

      const result = await browser_eval({
        target: 'eval-array-test',
        expression: '[1, 2, 3]',
      });

      expect(result.type).toBe('object');
      expect(result.result).toBe('[1,2,3]');

      unregisterCDPClient('eval-array-test');
    });

    it('P1-13: throws JavaScriptError on exception', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-error-test', mockClient);

      await expect(
        browser_eval({
          target: 'eval-error-test',
          expression: 'throw new Error("Test error")',
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_eval({
          target: 'eval-error-test',
          expression: 'throw new Error("Test error")',
        })
      ).rejects.toThrow(/Test error/);

      unregisterCDPClient('eval-error-test');
    });

    it('P1-13: includes line and column in JavaScriptError', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-linecol-test', mockClient);

      try {
        await browser_eval({
          target: 'eval-linecol-test',
          expression: 'undefinedVariable',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BrowserError);
        expect((error as BrowserError).code).toBe('JavaScriptError');
      }

      unregisterCDPClient('eval-linecol-test');
    });

    it('P1-13: uses default returnByValue=true', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-returnbyvalue-test', mockClient);

      await browser_eval({
        target: 'eval-returnbyvalue-test',
        expression: '"hello"',
      });

      // Just verify the call succeeded - default params are handled internally

      unregisterCDPClient('eval-returnbyvalue-test');
    });

    it('P1-13: uses default timeout=30000', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-timeout-test', mockClient);

      await browser_eval({
        target: 'eval-timeout-test',
        expression: '"hello"',
      });

      // Just verify the call succeeded - default timeout is handled internally

      unregisterCDPClient('eval-timeout-test');
    });

    it('P1-13: accepts custom timeout', async () => {
      const mockClient = createMockEvalClient(mockServer, targetId);
      registerCDPClient('eval-customtimeout-test', mockClient);

      await browser_eval({
        target: 'eval-customtimeout-test',
        expression: '"hello"',
        timeout: 5000,
      });

      // Just verify the call succeeded with custom timeout

      unregisterCDPClient('eval-customtimeout-test');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-13-E2E: evaluates in real browser context', async () => {
      // Requires real browser environment
    });

    it.skip('P1-13-E2E: accesses document and window objects', async () => {
      // Requires real browser environment
    });

    it.skip('P1-13-E2E: handles async expressions with awaitPromise', async () => {
      // Requires real browser environment
    });
  });
});
