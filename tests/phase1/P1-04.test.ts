import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import {
  browser_click,
  unregisterDOMTarget,
} from '../../pkgs/pi-web-browse/src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../pkgs/pi-web-browse/src/core/tools-page.js';
import { BrowserError } from '../../pkgs/pi-web-browse/src/core/errors.js';
import { launchChrome, fixtureUrl } from '../e2e/chrome-launcher.js';
import type { ChromeInstance } from '../e2e/chrome-launcher.js';

// Helper to create a CDP client for click testing
function createMockClickClient(mockServer: MockCDPServer, targetId: string) {
  let domEnabled = false;
  let mouseEvents: Array<{ type: string; x: number; y: number }> = [];

  return {
    async send(method: string, params?: Record<string, unknown>) {
      const tab = mockServer['tabs'].get(targetId);

      switch (method) {
        case 'DOM.enable':
          domEnabled = true;
          return {};

        case 'DOM.getDocument':
          return { root: { nodeId: 1 } };

        case 'DOM.querySelector': {
          const selector = String(params?.selector ?? '');
          // Simulate element found for valid selectors
          const isValid = selector.startsWith('#') || selector.startsWith('.');
          return { nodeId: isValid ? 2 : 0 };
        }

        case 'DOM.getBoxModel': {
          // Return content box model: [x1, y1, x2, y2, ...] for center calculation
          // Format: [x1, y1, x2, y1, x2, y2, x1, y2] (content box)
          return {
            model: {
              content: [100, 100, 200, 100, 200, 200, 100, 200],
            },
          };
        }

        case 'DOM.describeNode': {
          return {
            node: {
              nodeName: 'BUTTON',
              attributes: ['id', 'submit-btn', 'class', 'btn-primary'],
            },
          };
        }

        case 'Input.dispatchMouseEvent': {
          mouseEvents.push({
            type: String(params?.type ?? ''),
            x: Number(params?.x ?? 0),
            y: Number(params?.y ?? 0),
          });
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

// Mock client that returns element not found
function createNotFoundMockClient() {
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

// Mock client that returns invisible element (zero size)
function createInvisibleMockClient() {
  return {
    async send(method: string) {
      if (method === 'DOM.enable') {
        return {};
      }
      if (method === 'DOM.getDocument') {
        return { root: { nodeId: 1 } };
      }
      if (method === 'DOM.querySelector') {
        return { nodeId: 2 };
      }
      if (method === 'DOM.getBoxModel') {
        return {
          model: {
            content: [100, 100, 100, 100, 100, 100, 100, 100], // Zero width/height
          },
        };
      }
      return {};
    },
  };
}

// Mock client that throws on getBoxModel (hidden element)
function createHiddenMockClient() {
  return {
    async send(method: string) {
      if (method === 'DOM.enable') {
        return {};
      }
      if (method === 'DOM.getDocument') {
        return { root: { nodeId: 1 } };
      }
      if (method === 'DOM.querySelector') {
        return { nodeId: 2 };
      }
      if (method === 'DOM.getBoxModel') {
        throw new Error('Node is not visible');
      }
      return {};
    },
  };
}

describe('P1-04: browser_click', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9344;
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
      '<html><body><button id="submit-btn" class="btn-primary">Submit</button></body></html>'
    );

    registerCDPClient(targetId, createMockClickClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    unregisterDOMTarget(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-04: clicks element and returns metadata', async () => {
      const result = await browser_click({
        target: targetId,
        selector: '#submit-btn',
      });

      expect(result.clicked).toBe(true);
      expect(result.selector).toBe('#submit-btn');
      expect(result.coordinates.x).toBe(150); // Center of 100-200
      expect(result.coordinates.y).toBe(150); // Center of 100-200
      expect(result.element.tag).toBe('button');
      expect(result.element.id).toBe('submit-btn');
      expect(result.element.class).toBe('btn-primary');
    });

    it('P1-04: dispatches correct mouse event sequence', async () => {
      const mockClient = createMockClickClient(mockServer, targetId);
      registerCDPClient('click-seq-test', mockClient as unknown as ReturnType<typeof createMockClickClient>);

      await browser_click({
        target: 'click-seq-test',
        selector: '#test-btn',
      });

      const events = mockClient.getMouseEvents();
      expect(events.length).toBe(3);
      expect(events[0].type).toBe('mouseMoved');
      expect(events[1].type).toBe('mousePressed');
      expect(events[2].type).toBe('mouseReleased');

      unregisterCDPClient('click-seq-test');
    });
  });

  describe('Error Handling', () => {
    it('throws ElementNotFound for missing element', async () => {
      registerCDPClient(
        'not-found-test',
        createNotFoundMockClient() as unknown as ReturnType<typeof createMockClickClient>
      );

      try {
        await browser_click({ target: 'not-found-test', selector: '#nonexistent' });
        expect.fail('Expected ElementNotFound error');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('ElementNotFound');
          expect(error.message).toContain('Element not found');
        } else {
          throw error;
        }
      } finally {
        unregisterCDPClient('not-found-test');
      }
    });

    it('throws ElementNotVisible for zero-size element', async () => {
      registerCDPClient(
        'zero-size-test',
        createInvisibleMockClient() as unknown as ReturnType<typeof createMockClickClient>
      );

      try {
        await browser_click({ target: 'zero-size-test', selector: '#hidden' });
        expect.fail('Expected ElementNotVisible error');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('ElementNotVisible');
          expect(error.message).toContain('zero size');
        } else {
          throw error;
        }
      } finally {
        unregisterCDPClient('zero-size-test');
      }
    });

    it('throws ElementNotVisible for hidden element', async () => {
      registerCDPClient(
        'hidden-test',
        createHiddenMockClient() as unknown as ReturnType<typeof createMockClickClient>
      );

      try {
        await browser_click({ target: 'hidden-test', selector: '#hidden' });
        expect.fail('Expected ElementNotVisible error');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('ElementNotVisible');
        } else {
          throw error;
        }
      } finally {
        unregisterCDPClient('hidden-test');
      }
    });
  });

  describe('E2E Tests', () => {
    let chrome: ChromeInstance | null = null;
    let e2eTargetId: string;

    beforeAll(async () => {
      // Skip E2E tests if Chrome is not available
      try {
        chrome = await launchChrome({ headless: true, port: 9223 });

        // Navigate to form fixture
        const response = await fetch('http://localhost:9223/json/list');
        const tabs = await response.json();
        e2eTargetId = tabs[0].id;

        // Navigate via CDP
        await fetch(`http://localhost:9223/json/activate/${e2eTargetId}`);

        // Load the fixture using file URL
        const fixturePath = new URL(fixtureUrl('form-page.html'), 'file://').pathname;
        await fetch(`http://localhost:9223/json/activate/${e2eTargetId}`);
      } catch {
        // Chrome not available, tests will be skipped
      }
    }, 60000);

    afterAll(async () => {
      if (chrome) {
        await chrome.kill();
      }
    }, 30000);

    it.skip('P1-04-E2E: clicks element and fires event', async () => {
      // This test requires full CDP implementation
      // Skipping until E2E infrastructure is fully set up
    });

    it.skip('P1-04-E2E: screenshot verification after click', async () => {
      // This test requires screenshot capability
      // Skipping until E2E infrastructure is fully set up
    });
  });
});
