import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_type } from '../../src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/cdp-client.js';

// Helper to create a CDP client for type testing
function createMockTypeClient(mockServer: MockCDPServer, targetId: string) {
  const keyEvents: Array<{ type: string; text: string }> = [];
  const textInserts: string[] = [];

  return {
    async send(method: string, params?: Record<string, unknown>) {
      switch (method) {
        case 'Input.insertText': {
          textInserts.push(String(params?.text ?? ''));
          return { result: {} };
        }

        case 'Input.dispatchKeyEvent': {
          keyEvents.push({
            type: String(params?.type ?? ''),
            text: String(params?.text ?? ''),
          });
          return { result: {} };
        }

        default:
          return { result: {} };
      }
    },

    getKeyEvents() {
      return keyEvents;
    },

    getTextInserts() {
      return textInserts;
    },

    clearEvents() {
      keyEvents.length = 0;
      textInserts.length = 0;
    },
  };
}

describe('P1-06: browser_type', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9346;
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
      '<html><body><input id="test-input" /></body></html>'
    );

    registerCDPClient(targetId, createMockTypeClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-06: types text using insertText (fast path)', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-fast-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const result = await browser_type({
        target: 'type-fast-test',
        text: 'Hello World',
        delayMs: 0,
      });

      expect(result.typed).toBe(true);
      expect(result.length).toBe(11);

      // Should use insertText for instant typing
      expect(mockClient.getTextInserts()).toContain('Hello World');
      // Should not dispatch key events
      expect(mockClient.getKeyEvents().length).toBe(0);

      unregisterCDPClient('type-fast-test');
    });

    it('P1-06: types text with delay using key events (slow path)', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-slow-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const result = await browser_type({
        target: 'type-slow-test',
        text: 'Hi',
        delayMs: 10,
      });

      expect(result.typed).toBe(true);
      expect(result.length).toBe(2);

      const events = mockClient.getKeyEvents();
      // Each character should have keyDown and keyUp (4 events for 'Hi')
      expect(events.length).toBe(4);
      expect(events[0].type).toBe('keyDown');
      expect(events[0].text).toBe('H');
      expect(events[1].type).toBe('keyUp');
      expect(events[2].type).toBe('keyDown');
      expect(events[2].text).toBe('i');

      unregisterCDPClient('type-slow-test');
    });

    it('P1-06: handles empty text', async () => {
      const result = await browser_type({
        target: targetId,
        text: '',
      });

      expect(result.typed).toBe(true);
      expect(result.length).toBe(0);
    });

    it('P1-06: handles special characters', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-special-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const specialText = 'Hello!@#$%^&*()\n\t';
      await browser_type({
        target: 'type-special-test',
        text: specialText,
        delayMs: 0,
      });

      expect(mockClient.getTextInserts()[0]).toBe(specialText);

      unregisterCDPClient('type-special-test');
    });

    it('P1-06: handles unicode characters', async () => {
      const mockClient = createMockTypeClient(mockServer, targetId);
      registerCDPClient('type-unicode-test', mockClient as unknown as ReturnType<typeof createMockTypeClient>);

      const unicodeText = '日本語 中文 🎉 émojis';
      await browser_type({
        target: 'type-unicode-test',
        text: unicodeText,
        delayMs: 0,
      });

      expect(mockClient.getTextInserts()[0]).toBe(unicodeText);

      unregisterCDPClient('type-unicode-test');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-06-E2E: types into focused input field', async () => {
      // Test typing into an input element
    });

    it.skip('P1-06-E2E: types into cross-origin iframe', async () => {
      // This is the specific cross-origin iframe test requirement
      // Uses iframe-page.html fixture
    });

    it.skip('P1-06-E2E: screenshot verification shows typed text', async () => {
      // Take screenshot before and after typing to verify text appears
    });
  });
});
