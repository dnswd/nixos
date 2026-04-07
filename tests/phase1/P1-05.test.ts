import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_clickxy } from '../../pkgs/pi-web-browse/src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../pkgs/pi-web-browse/src/core/tools-page.js';
import { BrowserError } from '../../pkgs/pi-web-browse/src/core/errors.js';

// Helper to create a CDP client for clickXY testing
function createMockClickXYClient(mockServer: MockCDPServer, targetId: string) {
  let mouseEvents: Array<{ type: string; x: number; y: number; button?: string; clickCount?: number }> = [];

  return {
    async send(method: string, params?: Record<string, unknown>) {
      const tab = mockServer['tabs'].get(targetId);

      switch (method) {
        case 'Runtime.evaluate': {
          const expression = String(params?.expression ?? '');
          if (expression.includes('innerWidth') || expression.includes('innerHeight')) {
            return {
              result: {
                type: 'string',
                value: JSON.stringify({ width: 1024, height: 768 }),
              },
            };
          }
          return { result: {} };
        }

        case 'Input.dispatchMouseEvent': {
          mouseEvents.push({
            type: String(params?.type ?? ''),
            x: Number(params?.x ?? 0),
            y: Number(params?.y ?? 0),
            button: String(params?.button ?? ''),
            clickCount: Number(params?.clickCount ?? 0),
          });
          return { result: {} };
        }

        default:
          return { result: {} };
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

describe('P1-05: browser_clickxy', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9345;
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
      '<html><body><div id="shadow-host"></div></body></html>'
    );

    registerCDPClient(targetId, createMockClickXYClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-05: clicks at specified coordinates', async () => {
      const result = await browser_clickxy({
        target: targetId,
        x: 100,
        y: 200,
      });

      expect(result.clicked).toBe(true);
      expect(result.coordinates.x).toBe(100);
      expect(result.coordinates.y).toBe(200);
    });

    it('P1-05: dispatches correct mouse event sequence', async () => {
      const mockClient = createMockClickXYClient(mockServer, targetId);
      registerCDPClient('clickxy-seq-test', mockClient as unknown as ReturnType<typeof createMockClickXYClient>);

      await browser_clickxy({
        target: 'clickxy-seq-test',
        x: 50,
        y: 75,
      });

      const events = mockClient.getMouseEvents();
      expect(events.length).toBe(3);
      expect(events[0].type).toBe('mouseMoved');
      expect(events[0].x).toBe(50);
      expect(events[0].y).toBe(75);
      expect(events[1].type).toBe('mousePressed');
      expect(events[1].button).toBe('left');
      expect(events[1].clickCount).toBe(1);
      expect(events[2].type).toBe('mouseReleased');
      expect(events[2].button).toBe('left');

      unregisterCDPClient('clickxy-seq-test');
    });

    it('P1-05: works with fractional coordinates', async () => {
      const result = await browser_clickxy({
        target: targetId,
        x: 100.5,
        y: 200.7,
      });

      expect(result.clicked).toBe(true);
      // Coordinates should be preserved as provided
      expect(result.coordinates.x).toBe(100.5);
      expect(result.coordinates.y).toBe(200.7);
    });
  });

  describe('Error Handling', () => {
    it('throws InvalidCoordinates for negative x', async () => {
      try {
        await browser_clickxy({ target: targetId, x: -1, y: 100 });
        expect.fail('Expected InvalidCoordinates error');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('InvalidCoordinates');
          expect(error.message).toContain('Invalid');
          expect(error.details?.x).toBe(-1);
        } else {
          throw error;
        }
      }
    });

    it('throws InvalidCoordinates for negative y', async () => {
      try {
        await browser_clickxy({ target: targetId, x: 100, y: -5 });
        expect.fail('Expected InvalidCoordinates error');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('InvalidCoordinates');
          expect(error.details?.y).toBe(-5);
        } else {
          throw error;
        }
      }
    });

    it('warns for coordinates outside viewport', async () => {
      // This test verifies warning behavior - coordinates outside viewport
      // should warn but not fail (might be in iframe)
      const consoleWarns: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        consoleWarns.push(args.join(' '));
      };

      try {
        // Viewport is mocked as 1024x768
        await browser_clickxy({ target: targetId, x: 2000, y: 100 });

        // Should have logged a warning about coordinates outside viewport
        expect(consoleWarns.some(w => w.includes('outside viewport') || w.includes('outside'))).toBe(true);
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-05-E2E: clicks at coordinates in shadow DOM', async () => {
      // This test would use shadow-page.html fixture
      // Clicking inside shadow DOM where selector-based click fails
    });

    it.skip('P1-05-E2E: clicks at coordinates in cross-origin iframe', async () => {
      // This test would use iframe-page.html fixture
      // Clicking inside iframe where selector-based click may fail
    });

    it.skip('P1-05-E2E: screenshot verification with DPR coordinates', async () => {
      // Verify that CSS coordinates match screenshot pixels
    });
  });
});
