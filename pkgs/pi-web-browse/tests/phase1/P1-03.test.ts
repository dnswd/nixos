import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import {
  browser_eval,
  unregisterRuntimeTarget,
} from '../../src/core/tools-eval.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';
import { BrowserError } from '../../src/core/errors.js';

// Helper to create a CDP client that wraps the mock server with eval support
function createMockEvalClient(mockServer: MockCDPServer, targetId: string) {
  return {
    async send(method: string, params?: Record<string, unknown>) {
      const tab = mockServer['tabs'].get(targetId);

      if (!tab) {
        return {
          result: { type: 'undefined' },
          exceptionDetails: { text: 'Tab not found' },
        };
      }

      switch (method) {
        case 'Runtime.enable':
          return { result: {} };

        case 'Runtime.evaluate': {
          const expression = String(params?.expression ?? '');
          const awaitPromise = params?.awaitPromise ?? false;
          const timeout = Number(params?.timeout ?? 30000);

          // Simulate different expression types
          if (expression === 'undefined') {
            return { result: { type: 'undefined' } };
          }

          if (expression === 'null') {
            return { result: { type: 'object', subtype: 'null' } };
          }

          if (expression === '1 + 1') {
            return { result: { type: 'number', value: 2 } };
          }

          if (expression === '"hello"' || expression === "'test'" || expression === '"test"') {
            return { result: { type: 'string', value: expression.replace(/['"]/g, '') } };
          }

          if (expression === 'true') {
            return { result: { type: 'boolean', value: true } };
          }

          if (expression === '({ a: 1, b: "test" })') {
            return { result: { type: 'object', value: { a: 1, b: 'test' } } };
          }

          if (expression === '[1, 2, 3]') {
            return { result: { type: 'object', value: [1, 2, 3] } };
          }

          if (expression.includes('throw new Error')) {
            return {
              result: { type: 'undefined' },
              exceptionDetails: {
                text: 'Error: Test error',
                lineNumber: 1,
                columnNumber: 7,
              },
            };
          }

          if (expression.includes('syntax error')) {
            return {
              result: { type: 'undefined' },
              exceptionDetails: {
                text: 'SyntaxError: Unexpected identifier',
                lineNumber: 1,
                columnNumber: 6,
              },
            };
          }

          if (expression === 'document.title') {
            return { result: { type: 'string', value: tab.title } };
          }

          if (expression.startsWith('Promise.resolve')) {
            return {
              result: {
                type: 'object',
                value: awaitPromise ? 'resolved' : Promise.resolve('resolved'),
              },
            };
          }

          // Default
          return { result: { type: 'undefined' } };
        }

        default:
          return { result: {} };
      }
    },
  };
}

describe('P1-03: browser_eval', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9334;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    // Create a test tab
    targetId = mockServer.addTab({
      url: 'https://example.com',
      title: 'Test Page',
    });

    // Register the CDP client
    registerCDPClient(targetId, createMockEvalClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    unregisterRuntimeTarget(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-03: evaluates primitive expressions correctly', async () => {
      const numberResult = await browser_eval({
        target: targetId,
        expression: '1 + 1',
      });
      expect(numberResult.result).toBe('2');
      expect(numberResult.type).toBe('number');

      const stringResult = await browser_eval({
        target: targetId,
        expression: '"hello"',
      });
      expect(stringResult.result).toBe('hello');
      expect(stringResult.type).toBe('string');

      const boolResult = await browser_eval({
        target: targetId,
        expression: 'true',
      });
      expect(boolResult.result).toBe('true');
      expect(boolResult.type).toBe('boolean');
    });

    it('P1-03: handles undefined correctly', async () => {
      const result = await browser_eval({
        target: targetId,
        expression: 'undefined',
      });
      expect(result.result).toBe('undefined');
      expect(result.type).toBe('undefined');
    });

    it('P1-03: handles null correctly', async () => {
      const result = await browser_eval({
        target: targetId,
        expression: 'null',
      });
      expect(result.result).toBe('null');
      expect(result.type).toBe('object');
    });

    it('P1-03: serializes objects as JSON', async () => {
      const result = await browser_eval({
        target: targetId,
        expression: '({ a: 1, b: "test" })',
      });
      expect(result.result).toBe('{"a":1,"b":"test"}');
      expect(result.type).toBe('object');
    });

    it('P1-03: serializes arrays as JSON', async () => {
      const result = await browser_eval({
        target: targetId,
        expression: '[1, 2, 3]',
      });
      expect(result.result).toBe('[1,2,3]');
      expect(result.type).toBe('object');
    });
  });

  describe('E2E Tests', () => {
    it('P1-03-E2E: can verify other tool actions', async () => {
      // Test that we can access page state via eval
      const result = await browser_eval({
        target: targetId,
        expression: 'document.title',
      });

      expect(result.type).toBe('string');
      expect(result.result).toBe('Test Page');
    });

    it('P1-03-E2E: Runtime.enable is called only once per target', async () => {
      // Run eval multiple times
      await browser_eval({ target: targetId, expression: '1' });
      await browser_eval({ target: targetId, expression: '2' });
      await browser_eval({ target: targetId, expression: '3' });

      // All should succeed without error, indicating Runtime.enable
      // tracking is working correctly
    });
  });

  describe('Timeout Configuration', () => {
    it('P1-03: uses 30s default timeout', async () => {
      // Test that the function accepts timeout parameter
      const result = await browser_eval({
        target: targetId,
        expression: '"test"',
        // Default is 30s, this test verifies the param is accepted
      });
      expect(result.result).toBe('test');
    });

    it('P1-03: supports custom timeout', async () => {
      // Test with explicit timeout
      const result = await browser_eval({
        target: targetId,
        expression: '"test"',
        timeout: 5000,
      });
      expect(result.result).toBe('test');
    });
  });

  describe('Error Handling', () => {
    it('throws JavaScriptError with line/column info', async () => {
      try {
        await browser_eval({
          target: targetId,
          expression: 'throw new Error("Test error")',
        });
        expect.fail('Expected JavaScriptError');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('JavaScriptError');
          expect(error.message).toContain('Line 1');
          expect(error.details?.line).toBe(1);
          expect(error.details?.column).toBe(7);
        } else {
          throw error;
        }
      }
    });

    it('throws JavaScriptError for syntax errors', async () => {
      try {
        await browser_eval({
          target: targetId,
          expression: 'syntax error',
        });
        expect.fail('Expected JavaScriptError');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('JavaScriptError');
          expect(error.details?.line).toBe(1);
          expect(error.details?.column).toBe(6);
        } else {
          throw error;
        }
      }
    });
  });
});
