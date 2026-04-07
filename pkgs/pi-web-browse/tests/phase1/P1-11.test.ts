import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_type } from '../../src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';

// Helper to create a CDP client for type testing
function createMockTypeClient(mockServer: MockCDPServer, targetId: string) {
  let textEvents: Array<{ method: string; params: Record<string, unknown> }> = [];

  return {
    async send(method: string, params?: Record<string, unknown>) {
      const tab = mockServer['tabs'].get(targetId);

      switch (method) {
        case 'Input.insertText': {
          textEvents.push({ method, params: params ?? {} });
          return { result: {} };
        }

        case 'Input.dispatchKeyEvent': {
          textEvents.push({ method, params: params ?? {} });
          return { result: {} };
        }

        default:
          return { result: {} };
      }
    },

    getTextEvents() {
      return textEvents;
    },

    clearEvents() {
      textEvents = [];
    },
  };
}

describe('P1-11: browser_type', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9351;
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

    registerCDPClient(targetId, createMockTypeClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-11: fast path uses insertText for immediate insertion', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-fast-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const result = await browser_type({
        target: 'type-fast-test',
        text: 'Hello World',
        delayMs: 0,
      });

      expect(result.typed).toBe(true);
      expect(result.length).toBe(11);

      const events = mockClient.getTextEvents();
      expect(events.length).toBe(1);
      expect(events[0].method).toBe('Input.insertText');
      expect(events[0].params.text).toBe('Hello World');

      unregisterCDPClient('type-fast-test');
    });

    it('P1-11: slow path dispatches keyDown/keyUp per character', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-slow-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const result = await browser_type({
        target: 'type-slow-test',
        text: 'Hi',
        delayMs: 10,
      });

      expect(result.typed).toBe(true);
      expect(result.length).toBe(2);

      const events = mockClient.getTextEvents();
      // 2 characters x 2 events each (keyDown + keyUp) = 4 events
      expect(events.length).toBe(4);

      // First character
      expect(events[0].method).toBe('Input.dispatchKeyEvent');
      expect(events[0].params.type).toBe('keyDown');
      expect(events[0].params.text).toBe('H');
      expect(events[1].method).toBe('Input.dispatchKeyEvent');
      expect(events[1].params.type).toBe('keyUp');
      expect(events[1].params.text).toBe('H');

      // Second character
      expect(events[2].method).toBe('Input.dispatchKeyEvent');
      expect(events[2].params.type).toBe('keyDown');
      expect(events[2].params.text).toBe('i');
      expect(events[3].method).toBe('Input.dispatchKeyEvent');
      expect(events[3].params.type).toBe('keyUp');
      expect(events[3].params.text).toBe('i');

      unregisterCDPClient('type-slow-test');
    });

    it('P1-11: submit=true sends Enter key after text', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-submit-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const result = await browser_type({
        target: 'type-submit-test',
        text: 'search query',
        delayMs: 0,
        submit: true,
      });

      expect(result.typed).toBe(true);
      expect(result.length).toBe(12);

      const events = mockClient.getTextEvents();
      // insertText + Enter keyDown + Enter keyUp = 3 events
      expect(events.length).toBe(3);

      // Text insertion
      expect(events[0].method).toBe('Input.insertText');
      expect(events[0].params.text).toBe('search query');

      // Enter key
      expect(events[1].method).toBe('Input.dispatchKeyEvent');
      expect(events[1].params.type).toBe('keyDown');
      expect(events[1].params.key).toBe('Enter');
      expect(events[1].params.code).toBe('Enter');
      expect(events[1].params.windowsVirtualKeyCode).toBe(13);

      expect(events[2].method).toBe('Input.dispatchKeyEvent');
      expect(events[2].params.type).toBe('keyUp');
      expect(events[2].params.key).toBe('Enter');
      expect(events[2].params.code).toBe('Enter');
      expect(events[2].params.windowsVirtualKeyCode).toBe(13);

      unregisterCDPClient('type-submit-test');
    });

    it('P1-11: works with empty string', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-empty-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const result = await browser_type({
        target: 'type-empty-test',
        text: '',
        delayMs: 0,
      });

      expect(result.typed).toBe(true);
      expect(result.length).toBe(0);

      const events = mockClient.getTextEvents();
      expect(events.length).toBe(1); // Still sends insertText with empty string

      unregisterCDPClient('type-empty-test');
    });

    it('P1-11: handles unicode characters with fast path', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-unicode-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const result = await browser_type({
        target: 'type-unicode-test',
        text: 'こんにちは 🎉',
        delayMs: 0,
      });

      expect(result.typed).toBe(true);
      expect(result.length).toBe(8); // 5 Japanese + 1 space + 1 emoji (2 code units)

      const events = mockClient.getTextEvents();
      expect(events.length).toBe(1);
      expect(events[0].method).toBe('Input.insertText');
      expect(events[0].params.text).toBe('こんにちは 🎉');

      unregisterCDPClient('type-unicode-test');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-11-E2E: types into focused input field', async () => {
      // Requires real browser environment
    });

    it.skip('P1-11-E2E: works in cross-origin iframe', async () => {
      // Requires real browser environment
    });

    it.skip('P1-11-E2E: submit=true triggers form submission', async () => {
      // Requires real browser environment
    });
  });
});
