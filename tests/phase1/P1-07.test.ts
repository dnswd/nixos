import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import {
  browser_fill,
  browser_type,
} from '../../pkgs/pi-web-browse/src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../pkgs/pi-web-browse/src/core/tools-page.js';
import { BrowserError } from '../../pkgs/pi-web-browse/src/core/errors.js';

// Helper to create a CDP client for fill testing
function createMockFillClient(mockServer: MockCDPServer, targetId: string) {
  const events: Array<{
    type: 'click' | 'eval' | 'type';
    selector?: string;
    expression?: string;
    text?: string;
  }> = [];

  let lastFocusValue = '';

  return {
    async send(method: string, params?: Record<string, unknown>) {
      const tab = mockServer['tabs'].get(targetId);

      switch (method) {
        case 'DOM.enable':
          return {};

        case 'DOM.getDocument':
          return { root: { nodeId: 1 } };

        case 'DOM.querySelector': {
          const selector = String(params?.selector ?? '');
          const isValid = selector.startsWith('#') || selector.startsWith('.');
          return { nodeId: isValid ? 2 : 0 };
        }

        case 'DOM.getBoxModel': {
          return {
            model: {
              content: [100, 100, 200, 100, 200, 200, 100, 200],
            },
          };
        }

        case 'DOM.describeNode': {
          return {
            node: {
              nodeName: 'INPUT',
              attributes: ['id', 'test-input', 'type', 'text'],
            },
          };
        }

        case 'Input.dispatchMouseEvent': {
          events.push({ type: 'click' });
          return {};
        }

        case 'Runtime.enable':
          return {};

        case 'Runtime.evaluate': {
          const expression = String(params?.expression ?? '');
          events.push({ type: 'eval', expression });

          // Handle the clear expression
          if (expression.includes('document.activeElement.value')) {
            lastFocusValue = '';
            return { type: 'undefined' };
          }

          // Handle submit expression
          if (expression.includes('dispatchEvent')) {
            return { type: 'string', value: 'submitted' };
          }

          return {};
        }

        case 'Input.insertText': {
          events.push({ type: 'type', text: String(params?.text ?? '') });
          lastFocusValue += String(params?.text ?? '');
          return {};
        }

        default:
          return {};
      }
    },

    getEvents() {
      return events;
    },

    getValue() {
      return lastFocusValue;
    },

    clearEvents() {
      events.length = 0;
    },
  };
}

// Mock client that simulates element not found for fill
function createFillNotFoundMockClient() {
  return {
    async send(method: string) {
      if (method === 'DOM.enable') {
        return {};
      }
      if (method === 'DOM.getDocument') {
        return { root: { nodeId: 1 } };
      }
      if (method === 'DOM.querySelector') {
        return { nodeId: 0 };
      }
      return {};
    },
  };
}

describe('P1-07: browser_fill', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9347;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    targetId = mockServer.addTab({
      url: 'https://example.com',
      title: 'Test Page',
    });

    mockServer.setPageContent(
      targetId,
      '<html><body><form><input id="test-input" type="text" /></form></body></html>'
    );

    registerCDPClient(targetId, createMockFillClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-07: fills field with click + clear + type sequence', async () => {
      const mockClient = createMockFillClient(mockServer, targetId);
      registerCDPClient('fill-seq-test', mockClient as unknown as ReturnType<typeof createMockFillClient>);

      const result = await browser_fill({
        target: 'fill-seq-test',
        selector: '#test-input',
        value: 'test value',
        clear: true,
        submit: false,
      });

      expect(result.filled).toBe(true);
      expect(result.selector).toBe('#test-input');
      expect(result.submitted).toBe(false);

      // Verify the sequence: click, clear eval, type
      const events = mockClient.getEvents();
      expect(events.some(e => e.type === 'click')).toBe(true);
      expect(events.some(e => e.type === 'eval' && e.expression?.includes('activeElement.value'))).toBe(true);
      expect(events.some(e => e.type === 'type' && e.text === 'test value')).toBe(true);

      unregisterCDPClient('fill-seq-test');
    });

    it('P1-07: fills without clearing when clear=false', async () => {
      const mockClient = createMockFillClient(mockServer, targetId);
      registerCDPClient('fill-noclear-test', mockClient as unknown as ReturnType<typeof createMockFillClient>);

      await browser_fill({
        target: 'fill-noclear-test',
        selector: '#test-input',
        value: 'appended',
        clear: false,
      });

      // Should NOT have the clear eval
      const events = mockClient.getEvents();
      expect(events.some(e => e.type === 'eval' && e.expression?.includes('activeElement.value = ""'))).toBe(false);
      expect(events.some(e => e.type === 'type' && e.text === 'appended')).toBe(true);

      unregisterCDPClient('fill-noclear-test');
    });

    it('P1-07: submits form when submit=true', async () => {
      const mockClient = createMockFillClient(mockServer, targetId);
      registerCDPClient('fill-submit-test', mockClient as unknown as ReturnType<typeof createMockFillClient>);

      const result = await browser_fill({
        target: 'fill-submit-test',
        selector: '#test-input',
        value: 'submit test',
        submit: true,
      });

      expect(result.filled).toBe(true);
      expect(result.submitted).toBe(true);

      // Verify submit event was dispatched
      const events = mockClient.getEvents();
      expect(events.some(e => e.type === 'eval' && e.expression?.includes('dispatchEvent'))).toBe(true);

      unregisterCDPClient('fill-submit-test');
    });

    it('P1-07: throws ElementNotFound for missing element', async () => {
      registerCDPClient(
        'fill-not-found-test',
        createFillNotFoundMockClient() as unknown as ReturnType<typeof createMockFillClient>
      );

      try {
        await browser_fill({
          target: 'fill-not-found-test',
          selector: '#nonexistent',
          value: 'test',
        });
        expect.fail('Expected ElementNotFound error');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('ElementNotFound');
        } else {
          throw error;
        }
      } finally {
        unregisterCDPClient('fill-not-found-test');
      }
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-07-E2E: fills form input completely', async () => {
      // Test full fill cycle: click input, clear, type, verify value
    });

    it.skip('P1-07-E2E: fills and submits form', async () => {
      // Test fill with submit=true, verify form submission
    });

    it.skip('P1-07-E2E: screenshot verification shows filled text', async () => {
      // Take screenshot after fill to verify text appears
    });
  });
});
