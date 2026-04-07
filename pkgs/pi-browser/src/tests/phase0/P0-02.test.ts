import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_navigate } from '../../src/core/tools-nav.js';
import { registerCDPClient, unregisterCDPClient } from '../../src/core/cdp-client.js';

describe('P0-02: browser_navigate', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9223;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    // Create a test tab
    targetId = mockServer.addTab({
      url: 'about:blank',
      title: 'Blank Page'
    });
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P0-02: browser_navigate navigates and waits for load event', async () => {
      const testUrl = 'https://example.com/test-page';
      const tab = mockServer['tabs'].get(targetId);

      const mockClient = {
        async send(method: string, params?: Record<string, unknown>) {
          switch (method) {
            case 'Page.enable':
              return {};

            case 'Page.navigate': {
              if (tab) {
                tab.url = params?.url as string;
                tab.title = `Page: ${tab.url}`;
              }
              return { frameId: targetId };
            }

            case 'Runtime.evaluate': {
              const expr = String(params?.expression ?? '');
              if (!tab) return { result: { value: '' } };
              if (expr === 'window.location.href') {
                return { result: { value: tab.url } };
              }
              if (expr === 'document.title') {
                return { result: { value: tab.title } };
              }
              return { result: { value: null } };
            }

            default:
              return {};
          }
        },
        on(event: string, handler: (params: unknown) => void) {
          // Simulate firing load event immediately for testing
          if (event === 'Page.loadEventFired') {
            setTimeout(() => handler({ timestamp: Date.now() / 1000 }), 50);
          }
        },
        off() {},
        close() {}
      };

      unregisterCDPClient(targetId);
      registerCDPClient(targetId, mockClient as any);

      const result = await browser_navigate({
        target: targetId,
        url: testUrl,
        waitFor: 'load'
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe(testUrl);
      expect(result.title).toContain('Page:');
    });

    it('P0-02: browser_navigate supports domcontentloaded wait condition', async () => {
      const testUrl = 'https://example.com/fast-page';
      const tab = mockServer['tabs'].get(targetId);

      const mockClient = {
        async send(method: string, params?: Record<string, unknown>) {
          switch (method) {
            case 'Page.enable':
              return {};

            case 'Page.navigate': {
              if (tab) {
                tab.url = params?.url as string;
                tab.title = `Page: ${tab.url}`;
              }
              return { frameId: targetId };
            }

            case 'Runtime.evaluate': {
              const expr = String(params?.expression ?? '');
              if (!tab) return { result: { value: '' } };
              if (expr === 'window.location.href') {
                return { result: { value: tab.url } };
              }
              if (expr === 'document.title') {
                return { result: { value: tab.title } };
              }
              return { result: { value: null } };
            }

            default:
              return {};
          }
        },
        on(event: string, handler: (params: unknown) => void) {
          // Simulate firing DOMContentLoaded event immediately
          if (event === 'Page.domContentEventFired') {
            setTimeout(() => handler({ timestamp: Date.now() / 1000 }), 10);
          }
        },
        off() {},
        close() {}
      };

      unregisterCDPClient(targetId);
      registerCDPClient(targetId, mockClient as any);

      const result = await browser_navigate({
        target: targetId,
        url: testUrl,
        waitFor: 'domcontentloaded'
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe(testUrl);
    });

    it('P0-02: browser_navigate returns final URL and title', async () => {
      const testUrl = 'https://example.com/redirect-test';
      const finalUrl = 'https://example.com/final-destination';
      const finalTitle = 'Final Destination Page';

      const mockClient = {
        async send(method: string, params?: Record<string, unknown>) {
          switch (method) {
            case 'Page.enable':
              return {};

            case 'Page.navigate':
              // Start navigation but URL will change after redirect
              return { frameId: targetId };

            case 'Runtime.evaluate': {
              const expr = String(params?.expression ?? '');
              if (expr === 'window.location.href') {
                // Simulate final URL after redirect
                return { result: { value: finalUrl } };
              }
              if (expr === 'document.title') {
                return { result: { value: finalTitle } };
              }
              return { result: { value: null } };
            }

            default:
              return {};
          }
        },
        on(event: string, handler: (params: unknown) => void) {
          if (event === 'Page.loadEventFired') {
            setTimeout(() => handler({ timestamp: Date.now() / 1000 }), 50);
          }
        },
        off() {},
        close() {}
      };

      unregisterCDPClient(targetId);
      registerCDPClient(targetId, mockClient as any);

      const result = await browser_navigate({
        target: targetId,
        url: testUrl,
        waitFor: 'load'
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe(finalUrl);
      expect(result.title).toBe(finalTitle);
    });

    it('P0-02: browser_navigate times out after 30 seconds', async () => {
      const testUrl = 'https://example.com/slow-page';

      const mockClient = {
        async send(method: string) {
          switch (method) {
            case 'Page.enable':
              return {};
            case 'Page.navigate':
              return { frameId: targetId };
            default:
              return {};
          }
        },
        on() {
          // Never fire the event - simulate timeout
        },
        off() {},
        close() {}
      };

      unregisterCDPClient(targetId);
      registerCDPClient(targetId, mockClient as any);

      // This test should timeout - use a shorter timeout for testing
      // We'll verify the timeout logic works by checking the error message
      await expect(
        browser_navigate({
          target: targetId,
          url: testUrl,
          waitFor: 'load'
        })
      ).rejects.toThrow('Timeout');
    }, 35000); // 35 second test timeout to allow for 30s navigation timeout
  });

  describe('Error Handling', () => {
    it('throws error on navigation failure', async () => {
      const mockClient = {
        async send(method: string) {
          switch (method) {
            case 'Page.enable':
              return {};
            case 'Page.navigate':
              // Simulate navigation error
              return { frameId: '', errorText: 'Failed to load: ERR_CONNECTION_REFUSED' };
            default:
              return {};
          }
        },
        on() {},
        off() {},
        close() {}
      };

      unregisterCDPClient(targetId);
      registerCDPClient(targetId, mockClient as any);

      await expect(
        browser_navigate({
          target: targetId,
          url: 'https://invalid.test',
          waitFor: 'load'
        })
      ).rejects.toThrow('Navigation failed');
    });
  });
});
