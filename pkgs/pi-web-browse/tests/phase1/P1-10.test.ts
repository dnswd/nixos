import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_clickxy } from '../../src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';
import { BrowserError } from '../../src/core/errors.js';

// Helper to create a CDP client for clickxy testing
function createMockClickXYClient(mockServer: MockCDPServer, targetId: string) {
  let mouseEvents: Array<{ method: string; params: Record<string, unknown> }> = [];

  return {
    async send(method: string, params?: Record<string, unknown>) {
      switch (method) {
        case 'Runtime.evaluate': {
          // Return viewport size for coordinate validation
          return {
            result: {
              type: 'string',
              value: JSON.stringify({ width: 1024, height: 768 }),
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

describe('P1-10: browser_clickxy', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9353;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    targetId = mockServer.addTab({
      url: 'https://example.com',
      title: 'Test Page',
    });

    registerCDPClient(targetId, createMockClickXYClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-10: dispatches events at exact coordinates', async () => {
      const mockClient = createMockClickXYClient(mockServer, targetId);
      registerCDPClient('clickxy-exact-test', mockClient as unknown as ReturnType<typeof createMockClickXYClient>);

      const result = await browser_clickxy({
        target: 'clickxy-exact-test',
        x: 500,
        y: 300,
        waitForStable: 0,
      });

      expect(result.clicked).toBe(true);
      expect(result.coordinates.x).toBe(500);
      expect(result.coordinates.y).toBe(300);

      const events = mockClient.getMouseEvents();
      expect(events.length).toBe(3);

      // All events should use the exact coordinates
      events.forEach(event => {
        expect(event.params.x).toBe(500);
        expect(event.params.y).toBe(300);
      });

      unregisterCDPClient('clickxy-exact-test');
    });

    it('P1-10: dispatches correct 3-event sequence (move, press, release)', async () => {
      const mockClient = createMockClickXYClient(mockServer, targetId);
      registerCDPClient('clickxy-sequence-test', mockClient as unknown as ReturnType<typeof createMockClickXYClient>);

      await browser_clickxy({
        target: 'clickxy-sequence-test',
        x: 100,
        y: 200,
        waitForStable: 0,
      });

      const events = mockClient.getMouseEvents();
      expect(events.length).toBe(3);

      expect(events[0].params.type).toBe('mouseMoved');
      expect(events[1].params.type).toBe('mousePressed');
      expect(events[1].params.button).toBe('left');
      expect(events[1].params.clickCount).toBe(1);
      expect(events[2].params.type).toBe('mouseReleased');
      expect(events[2].params.button).toBe('left');
      expect(events[2].params.clickCount).toBe(1);

      unregisterCDPClient('clickxy-sequence-test');
    });

    it('P1-10: validates negative x coordinate throws error', async () => {
      const mockClient = createMockClickXYClient(mockServer, targetId);
      registerCDPClient('clickxy-negx-test', mockClient as unknown as ReturnType<typeof createMockClickXYClient>);

      await expect(
        browser_clickxy({
          target: 'clickxy-negx-test',
          x: -10,
          y: 100,
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_clickxy({
          target: 'clickxy-negx-test',
          x: -10,
          y: 100,
        })
      ).rejects.toThrow(/Invalid coordinates/);

      unregisterCDPClient('clickxy-negx-test');
    });

    it('P1-10: validates negative y coordinate throws error', async () => {
      const mockClient = createMockClickXYClient(mockServer, targetId);
      registerCDPClient('clickxy-negy-test', mockClient as unknown as ReturnType<typeof createMockClickXYClient>);

      await expect(
        browser_clickxy({
          target: 'clickxy-negy-test',
          x: 100,
          y: -5,
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_clickxy({
          target: 'clickxy-negy-test',
          x: 100,
          y: -5,
        })
      ).rejects.toThrow(/Invalid coordinates/);

      unregisterCDPClient('clickxy-negy-test');
    });

    it('P1-10: allows zero coordinates (edge of viewport)', async () => {
      const mockClient = createMockClickXYClient(mockServer, targetId);
      registerCDPClient('clickxy-zero-test', mockClient as unknown as ReturnType<typeof createMockClickXYClient>);

      const result = await browser_clickxy({
        target: 'clickxy-zero-test',
        x: 0,
        y: 0,
        waitForStable: 0,
      });

      expect(result.clicked).toBe(true);
      expect(result.coordinates.x).toBe(0);
      expect(result.coordinates.y).toBe(0);

      const events = mockClient.getMouseEvents();
      expect(events[0].params.x).toBe(0);
      expect(events[0].params.y).toBe(0);

      unregisterCDPClient('clickxy-zero-test');
    });

    it('P1-10: works with coordinates outside viewport (for iframes)', async () => {
      const mockClient = createMockClickXYClient(mockServer, targetId);
      registerCDPClient('clickxy-outside-test', mockClient as unknown as ReturnType<typeof createMockClickXYClient>);

      // Coordinates outside 1024x768 viewport should still work
      const result = await browser_clickxy({
        target: 'clickxy-outside-test',
        x: 2000,
        y: 1500,
        waitForStable: 0,
      });

      expect(result.clicked).toBe(true);

      unregisterCDPClient('clickxy-outside-test');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-10-E2E: clicks at exact coordinates in real browser', async () => {
      // Requires real browser environment
    });

    it.skip('P1-10-E2E: works in shadow DOM elements', async () => {
      // Requires real browser environment
    });

    it.skip('P1-10-E2E: works in cross-origin iframes', async () => {
      // Requires real browser environment
    });
  });
});
