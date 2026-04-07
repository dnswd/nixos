import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_click } from '../../src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';
import { BrowserError } from '../../src/core/errors.js';

// Helper to create a CDP client for click testing
function createMockClickClient(mockServer: MockCDPServer, targetId: string) {
  let mouseEvents: Array<{ method: string; params: Record<string, unknown> }> = [];

  return {
    async send(method: string, params?: Record<string, unknown>) {
      const tab = mockServer['tabs'].get(targetId);

      switch (method) {
        case 'DOM.enable': {
          return { result: {} };
        }

        case 'DOM.getDocument': {
          return { root: { nodeId: 1 } };
        }

        case 'DOM.querySelector': {
          const { selector } = params ?? {};
          // Simulate not found for '.nonexistent'
          if (selector === '.nonexistent') {
            return { nodeId: 0 };
          }
          return { nodeId: 2 };
        }

        case 'DOM.getBoxModel': {
          const { nodeId } = params ?? {};
          // Simulate hidden element (zero size) for '.hidden'
          const tab = mockServer['tabs'].get(targetId);
          if (tab?.html?.includes('class="hidden"')) {
            // Return zero-size box model instead of throwing
            return {
              model: {
                content: [100, 100, 100, 100, 100, 100, 100, 100], // x1=y1=x2=y2 means zero size
              },
            };
          }
          // Normal visible element
          return {
            model: {
              content: [100, 100, 200, 100, 200, 200, 100, 200], // x1=100, y1=100, x2=200, y2=200
            },
          };
        }

        case 'DOM.describeNode': {
          return {
            node: {
              nodeId: 2,
              nodeName: 'BUTTON',
              attributes: ['id', 'test-btn', 'class', 'primary'],
            },
          };
        }

        case 'Input.dispatchMouseEvent': {
          mouseEvents.push({ method, params: params ?? {} });
          return {};
        }

        default:
          return {};
      }
    },

    getMouseEvents() {
      return mouseEvents;
    },

    clearEvents() {
      mouseEvents = [];
    },
  };
}

describe('P1-09: browser_click', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9352;
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
      '<html><body><button id="test-btn" class="primary">Click Me</button></body></html>'
    );

    registerCDPClient(targetId, createMockClickClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-09: resolves selector to nodeId and returns element metadata', async () => {
      const mockClient = createMockClickClient(mockServer, targetId);
      registerCDPClient('click-metadata-test', mockClient as unknown as ReturnType<typeof createMockClickClient>);

      const result = await browser_click({
        target: 'click-metadata-test',
        selector: '#test-btn',
      });

      expect(result.clicked).toBe(true);
      expect(result.selector).toBe('#test-btn');
      expect(result.element.tag).toBe('button');
      expect(result.element.id).toBe('test-btn');
      expect(result.element.class).toBe('primary');
      expect(result.coordinates.x).toBe(150); // (100 + 200) / 2
      expect(result.coordinates.y).toBe(150); // (100 + 200) / 2

      unregisterCDPClient('click-metadata-test');
    });

    it('P1-09: dispatches 3 mouse events (move, press, release)', async () => {
      const mockClient = createMockClickClient(mockServer, targetId);
      registerCDPClient('click-events-test', mockClient as unknown as ReturnType<typeof createMockClickClient>);

      await browser_click({
        target: 'click-events-test',
        selector: '#test-btn',
        waitForStable: 0, // No delay for faster tests
      });

      const events = mockClient.getMouseEvents();
      expect(events.length).toBe(3);

      // First: mouseMoved
      expect(events[0].method).toBe('Input.dispatchMouseEvent');
      expect(events[0].params.type).toBe('mouseMoved');
      expect(events[0].params.x).toBe(150);
      expect(events[0].params.y).toBe(150);

      // Second: mousePressed
      expect(events[1].method).toBe('Input.dispatchMouseEvent');
      expect(events[1].params.type).toBe('mousePressed');
      expect(events[1].params.button).toBe('left');
      expect(events[1].params.clickCount).toBe(1);

      // Third: mouseReleased
      expect(events[2].method).toBe('Input.dispatchMouseEvent');
      expect(events[2].params.type).toBe('mouseReleased');
      expect(events[2].params.button).toBe('left');
      expect(events[2].params.clickCount).toBe(1);

      unregisterCDPClient('click-events-test');
    });

    it('P1-09: throws ElementNotFound for invalid selector', async () => {
      const mockClient = createMockClickClient(mockServer, targetId);
      registerCDPClient('click-notfound-test', mockClient as unknown as ReturnType<typeof createMockClickClient>);

      await expect(
        browser_click({
          target: 'click-notfound-test',
          selector: '.nonexistent',
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_click({
          target: 'click-notfound-test',
          selector: '.nonexistent',
        })
      ).rejects.toThrow(/Element not found/);

      unregisterCDPClient('click-notfound-test');
    });

    it('P1-09: throws ElementNotVisible for hidden element', async () => {
      // Create a tab with hidden element
      const hiddenTargetId = mockServer.addTab({
        url: 'https://example.com/hidden',
        title: 'Hidden Page',
      });
      mockServer.setPageContent(
        hiddenTargetId,
        '<html><body><button class="hidden" style="display:none">Hidden</button></body></html>'
      );

      const mockClient = createMockClickClient(mockServer, hiddenTargetId);
      registerCDPClient('click-hidden-test', mockClient as unknown as ReturnType<typeof createMockClickClient>);

      await expect(
        browser_click({
          target: 'click-hidden-test',
          selector: '.hidden',
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_click({
          target: 'click-hidden-test',
          selector: '.hidden',
        })
      ).rejects.toThrow(/Element has zero size/);

      unregisterCDPClient('click-hidden-test');
    });

    it('P1-09: throws ElementNotVisible when getBoxModel throws', async () => {
      // Test with element where getBoxModel throws
      const failClient = {
        async send(method: string, params?: Record<string, unknown>) {
          switch (method) {
            case 'DOM.enable':
              return {};
            case 'DOM.getDocument':
              return { root: { nodeId: 1 } };
            case 'DOM.querySelector':
              return { nodeId: 2 };
            case 'DOM.getBoxModel':
              throw new Error('Node is not visible');
            default:
              return {};
          }
        },
      };

      registerCDPClient('click-boxmodel-fail', failClient);

      await expect(
        browser_click({
          target: 'click-boxmodel-fail',
          selector: '#test',
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_click({
          target: 'click-boxmodel-fail',
          selector: '#test',
        })
      ).rejects.toThrow(/Element found but not visible/);

      unregisterCDPClient('click-boxmodel-fail');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-09-E2E: clicks a real button element', async () => {
      // Requires real browser environment
    });

    it.skip('P1-09-E2E: clicks element in cross-origin iframe', async () => {
      // Requires real browser environment
    });
  });
});
