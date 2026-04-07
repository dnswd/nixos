import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_fill } from '../../src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';
import { BrowserError } from '../../src/core/errors.js';

// Helper to create a CDP client for fill testing
function createMockFillClient(mockServer: MockCDPServer, targetId: string) {
  let events: Array<{ method: string; params: Record<string, unknown> }> = [];
  let activeElementValue = '';
  let hasForm = false;

  return {
    async send(method: string, params?: Record<string, unknown>) {
      switch (method) {
        case 'DOM.enable':
          return {};

        case 'DOM.getDocument':
          return { root: { nodeId: 1 } };

        case 'DOM.querySelector': {
          const { selector } = params ?? {};
          if (selector === '.nonexistent') {
            return { nodeId: 0 };
          }
          return { nodeId: 2 };
        }

        case 'DOM.getBoxModel':
          return {
            model: {
              content: [100, 100, 300, 100, 300, 150, 100, 150],
            },
          };

        case 'DOM.describeNode':
          return {
            node: {
              nodeId: 2,
              nodeName: 'INPUT',
              attributes: ['id', 'email', 'type', 'email'],
            },
          };

        case 'Input.dispatchMouseEvent': {
          events.push({ method, params: params ?? {} });
          return {};
        }

        case 'Input.insertText': {
          events.push({ method, params: params ?? {} });
          activeElementValue = params?.text as string;
          return {};
        }

        case 'Runtime.evaluate': {
          const { expression } = params ?? {};
          events.push({ method, params: { expression } });

          if (expression?.includes('document.activeElement.value = ""')) {
            activeElementValue = '';
            return { result: { type: 'undefined' } };
          }

          if (expression?.includes('document.activeElement') && expression?.includes('form')) {
            // Simulate form submit detection
            return {
              result: {
                type: 'string',
                value: hasForm ? 'submitted' : 'no-form',
              },
            };
          }

          return { result: { type: 'undefined' } };
        }

        default:
          return {};
      }
    },

    getEvents() {
      return events;
    },

    clearEvents() {
      events = [];
    },

    setHasForm(value: boolean) {
      hasForm = value;
    },

    getActiveElementValue() {
      return activeElementValue;
    },
  };
}

describe('P1-12: browser_fill', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9354;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    targetId = mockServer.addTab({
      url: 'https://example.com/form',
      title: 'Form Page',
    });

    mockServer.setPageContent(
      targetId,
      '<html><body><form><input type="email" id="email" /></form></body></html>'
    );

    registerCDPClient(targetId, createMockFillClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-12: fills field with click + clear + type sequence', async () => {
      const mockClient = createMockFillClient(mockServer, targetId);
      registerCDPClient('fill-sequence-test', mockClient as unknown as ReturnType<typeof createMockFillClient>);

      const result = await browser_fill({
        target: 'fill-sequence-test',
        selector: '#email',
        value: 'test@example.com',
        clear: true,
        submit: false,
      });

      expect(result.filled).toBe(true);
      expect(result.selector).toBe('#email');
      expect(result.submitted).toBe(false);

      const events = mockClient.getEvents();

      // Should have click events (3 mouse events)
      const mouseEvents = events.filter(e => e.method === 'Input.dispatchMouseEvent');
      expect(mouseEvents.length).toBe(3);

      // Should have clear Runtime.evaluate
      const clearEvent = events.find(e =>
        e.method === 'Runtime.evaluate' &&
        e.params.expression?.includes('document.activeElement.value = ""')
      );
      expect(clearEvent).toBeDefined();

      // Should have insertText
      const insertEvent = events.find(e => e.method === 'Input.insertText');
      expect(insertEvent).toBeDefined();
      expect(insertEvent?.params.text).toBe('test@example.com');

      unregisterCDPClient('fill-sequence-test');
    });

    it('P1-12: fills without clearing when clear=false', async () => {
      const mockClient = createMockFillClient(mockServer, targetId);
      registerCDPClient('fill-noclear-test', mockClient as unknown as ReturnType<typeof createMockFillClient>);

      const result = await browser_fill({
        target: 'fill-noclear-test',
        selector: '#email',
        value: 'user@example.com',
        clear: false,
        submit: false,
      });

      expect(result.filled).toBe(true);

      const events = mockClient.getEvents();

      // Should NOT have clear Runtime.evaluate
      const clearEvent = events.find(e =>
        e.method === 'Runtime.evaluate' &&
        e.params.expression?.includes('document.activeElement.value = ""')
      );
      expect(clearEvent).toBeUndefined();

      // Should still have insertText
      const insertEvent = events.find(e => e.method === 'Input.insertText');
      expect(insertEvent).toBeDefined();

      unregisterCDPClient('fill-noclear-test');
    });

    it('P1-12: submits form when submit=true and form exists', async () => {
      const mockClient = createMockFillClient(mockServer, targetId);
      mockClient.setHasForm(true);
      registerCDPClient('fill-submit-test', mockClient as unknown as ReturnType<typeof createMockFillClient>);

      const result = await browser_fill({
        target: 'fill-submit-test',
        selector: '#email',
        value: 'submit@example.com',
        clear: true,
        submit: true,
      });

      expect(result.filled).toBe(true);
      expect(result.submitted).toBe(true);

      const events = mockClient.getEvents();

      // Should have form submit evaluation
      const submitEvent = events.find(e =>
        e.method === 'Runtime.evaluate' &&
        e.params.expression?.includes('submitted')
      );
      expect(submitEvent).toBeDefined();

      unregisterCDPClient('fill-submit-test');
    });

    it('P1-12: submitted=false when no form exists', async () => {
      const mockClient = createMockFillClient(mockServer, targetId);
      mockClient.setHasForm(false);
      registerCDPClient('fill-nosubmit-test', mockClient as unknown as ReturnType<typeof createMockFillClient>);

      const result = await browser_fill({
        target: 'fill-nosubmit-test',
        selector: '#email',
        value: 'nosubmit@example.com',
        clear: true,
        submit: true,
      });

      expect(result.filled).toBe(true);
      expect(result.submitted).toBe(false);

      unregisterCDPClient('fill-nosubmit-test');
    });

    it('P1-12: throws ElementNotFound for missing element', async () => {
      const mockClient = createMockFillClient(mockServer, targetId);
      registerCDPClient('fill-notfound-test', mockClient as unknown as ReturnType<typeof createMockFillClient>);

      await expect(
        browser_fill({
          target: 'fill-notfound-test',
          selector: '.nonexistent',
          value: 'test',
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_fill({
          target: 'fill-notfound-test',
          selector: '.nonexistent',
          value: 'test',
        })
      ).rejects.toThrow(/Element not found/);

      unregisterCDPClient('fill-notfound-test');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-12-E2E: fills a real form field', async () => {
      // Requires real browser environment
    });

    it.skip('P1-12-E2E: submits a real form', async () => {
      // Requires real browser environment
    });

    it.skip('P1-12-E2E: works with select dropdowns', async () => {
      // Requires real browser environment
    });
  });
});
