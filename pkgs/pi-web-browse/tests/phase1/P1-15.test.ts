import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_press } from '../../src/core/tools-eval.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';

// Helper to create a CDP client for press testing
function createMockPressClient(mockServer: MockCDPServer, targetId: string) {
  let keyEvents: Array<{ method: string; params: Record<string, unknown> }> = [];

  return {
    async send(method: string, params?: Record<string, unknown>) {
      const tab = mockServer['tabs'].get(targetId);

      switch (method) {
        case 'Input.dispatchKeyEvent': {
          keyEvents.push({ method, params: params ?? {} });
          return { result: {} };
        }

        default:
          return { result: {} };
      }
    },

    getKeyEvents() {
      return keyEvents;
    },

    clearEvents() {
      keyEvents = [];
    },
  };
}

describe('P1-15: browser_press', () => {
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

    mockServer.setPageContent(
      targetId,
      '<html><body><input type="text" id="input" /></body></html>'
    );

    registerCDPClient(targetId, createMockPressClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-15: dispatches keyDown/keyUp for Enter', async () => {
      const mockClient = createMockPressClient(mockServer, targetId);
      registerCDPClient('press-enter-test', mockClient as unknown as ReturnType<typeof createMockPressClient>);

      const result = await browser_press({
        target: 'press-enter-test',
        key: 'Enter',
      });

      expect(result.pressed).toBe(true);
      expect(result.key).toBe('Enter');
      expect(result.count).toBe(1);

      const events = mockClient.getKeyEvents();
      expect(events.length).toBe(2);

      // keyDown
      expect(events[0].method).toBe('Input.dispatchKeyEvent');
      expect(events[0].params.type).toBe('keyDown');
      expect(events[0].params.key).toBe('Enter');
      expect(events[0].params.code).toBe('Enter');
      expect(events[0].params.windowsVirtualKeyCode).toBe(13);

      // keyUp
      expect(events[1].method).toBe('Input.dispatchKeyEvent');
      expect(events[1].params.type).toBe('keyUp');
      expect(events[1].params.key).toBe('Enter');
      expect(events[1].params.code).toBe('Enter');
      expect(events[1].params.windowsVirtualKeyCode).toBe(13);

      unregisterCDPClient('press-enter-test');
    });

    it('P1-15: supports count for repeated presses', async () => {
      const mockClient = createMockPressClient(mockServer, targetId);
      registerCDPClient('press-count-test', mockClient as unknown as ReturnType<typeof createMockPressClient>);

      const result = await browser_press({
        target: 'press-count-test',
        key: 'ArrowDown',
        count: 3,
      });

      expect(result.pressed).toBe(true);
      expect(result.key).toBe('ArrowDown');
      expect(result.count).toBe(3);

      const events = mockClient.getKeyEvents();
      // 3 presses x 2 events each (keyDown + keyUp) = 6 events
      expect(events.length).toBe(6);

      // All events should be ArrowDown
      for (const event of events) {
        expect(event.params.key).toBe('ArrowDown');
        expect(event.params.code).toBe('ArrowDown');
        expect(event.params.windowsVirtualKeyCode).toBe(40);
      }

      // Check alternating keyDown/keyUp pattern
      expect(events[0].params.type).toBe('keyDown');
      expect(events[1].params.type).toBe('keyUp');
      expect(events[2].params.type).toBe('keyDown');
      expect(events[3].params.type).toBe('keyUp');
      expect(events[4].params.type).toBe('keyDown');
      expect(events[5].params.type).toBe('keyUp');

      unregisterCDPClient('press-count-test');
    });

    it('P1-15: supports common keys list', async () => {
      const keys = [
        { key: 'Enter', code: 'Enter', vk: 13 },
        { key: 'Escape', code: 'Escape', vk: 27 },
        { key: 'Tab', code: 'Tab', vk: 9 },
        { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
        { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
        { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
        { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
        { key: 'Backspace', code: 'Backspace', vk: 8 },
        { key: 'Delete', code: 'Delete', vk: 46 },
      ];

      for (const { key, code, vk } of keys) {
        const mockClient = createMockPressClient(mockServer, targetId);
        const clientId = `press-${key.toLowerCase()}-test`;
        registerCDPClient(clientId, mockClient as unknown as ReturnType<typeof createMockPressClient>);

        const result = await browser_press({
          target: clientId,
          key,
        });

        expect(result.pressed).toBe(true);
        expect(result.key).toBe(key);

        const events = mockClient.getKeyEvents();
        expect(events.length).toBe(2);
        expect(events[0].params.key).toBe(key);
        expect(events[0].params.code).toBe(code);
        expect(events[0].params.windowsVirtualKeyCode).toBe(vk);

        unregisterCDPClient(clientId);
      }
    });

    it('P1-15: supports function keys F1-F12', async () => {
      const functionKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

      for (const key of functionKeys) {
        const mockClient = createMockPressClient(mockServer, targetId);
        const clientId = `press-${key.toLowerCase()}-test`;
        registerCDPClient(clientId, mockClient as unknown as ReturnType<typeof createMockPressClient>);

        const result = await browser_press({
          target: clientId,
          key,
        });

        expect(result.pressed).toBe(true);
        expect(result.key).toBe(key);

        const events = mockClient.getKeyEvents();
        expect(events.length).toBe(2);
        expect(events[0].params.key).toBe(key);
        expect(events[0].params.code).toBe(key);
        // Function keys don't have windowsVirtualKeyCode defined
        expect(events[0].params.windowsVirtualKeyCode).toBeUndefined();

        unregisterCDPClient(clientId);
      }
    });

    it('P1-15: supports Home and End keys', async () => {
      const keys = ['Home', 'End'];

      for (const key of keys) {
        const mockClient = createMockPressClient(mockServer, targetId);
        const clientId = `press-${key.toLowerCase()}-test`;
        registerCDPClient(clientId, mockClient as unknown as ReturnType<typeof createMockPressClient>);

        const result = await browser_press({
          target: clientId,
          key,
        });

        expect(result.pressed).toBe(true);
        expect(result.key).toBe(key);

        const events = mockClient.getKeyEvents();
        expect(events.length).toBe(2);
        expect(events[0].params.key).toBe(key);
        expect(events[0].params.code).toBe(key);

        unregisterCDPClient(clientId);
      }
    });

    it('P1-15: supports PageUp and PageDown keys', async () => {
      const keys = ['PageUp', 'PageDown'];

      for (const key of keys) {
        const mockClient = createMockPressClient(mockServer, targetId);
        const clientId = `press-${key.toLowerCase()}-test`;
        registerCDPClient(clientId, mockClient as unknown as ReturnType<typeof createMockPressClient>);

        const result = await browser_press({
          target: clientId,
          key,
        });

        expect(result.pressed).toBe(true);
        expect(result.key).toBe(key);

        const events = mockClient.getKeyEvents();
        expect(events.length).toBe(2);
        expect(events[0].params.key).toBe(key);
        expect(events[0].params.code).toBe(key);

        unregisterCDPClient(clientId);
      }
    });

    it('P1-15: returns pressed, key, count in result', async () => {
      const mockClient = createMockPressClient(mockServer, targetId);
      registerCDPClient('press-result-test', mockClient as unknown as ReturnType<typeof createMockPressClient>);

      const result = await browser_press({
        target: 'press-result-test',
        key: 'Escape',
        count: 2,
      });

      expect(result).toHaveProperty('pressed');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('count');
      expect(result.pressed).toBe(true);
      expect(result.key).toBe('Escape');
      expect(result.count).toBe(2);

      unregisterCDPClient('press-result-test');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-15-E2E: works with focused input field', async () => {
      // Requires real browser environment
    });

    it.skip('P1-15-E2E: Enter submits focused form', async () => {
      // Requires real browser environment
    });

    it.skip('P1-15-E2E: Arrow keys navigate in select dropdown', async () => {
      // Requires real browser environment
    });
  });
});
