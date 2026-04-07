import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_navigate } from '../../config/devel/pi-mono/extensions/pi-browser/src/core/tools-nav.js';
import { registerCDPClient, unregisterCDPClient } from '../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js';

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

    // Set environment variable for CDP connection
    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    delete process.env.CDP_WS_URL;
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('should navigate and wait for load event', async () => {
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

    it('should support domcontentloaded wait condition', async () => {
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

    it('should return final URL and title', async () => {
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

    it('should support networkidle wait condition', async () => {
      const testUrl = 'https://spa-app.com';
      const tab = mockServer['tabs'].get(targetId);
      let lastRequestTime = Date.now();
      let requestHandler: ((params: unknown) => void) | null = null;
      let responseHandler: ((params: unknown) => void) | null = null;

      const mockClient = {
        async send(method: string, params?: Record<string, unknown>) {
          switch (method) {
            case 'Page.enable':
              return {};
            case 'Network.enable':
              // After enabling network, simulate some activity then quiet period
              setTimeout(() => {
                // Simulate 3 requests
                for (let i = 0; i < 3; i++) {
                  setTimeout(() => {
                    lastRequestTime = Date.now();
                    requestHandler?.({ requestId: `req-${i}` });
                    setTimeout(() => {
                      lastRequestTime = Date.now();
                      responseHandler?.({ requestId: `req-${i}` });
                    }, 50);
                  }, i * 100);
                }
              }, 50);
              return {};
            case 'Page.navigate': {
              if (tab) {
                tab.url = params?.url as string;
                tab.title = `SPA: ${tab.url}`;
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
          if (event === 'Network.requestWillBeSent') {
            requestHandler = handler;
          }
          if (event === 'Network.responseReceived') {
            responseHandler = handler;
          }
        },
        off() {
          requestHandler = null;
          responseHandler = null;
        },
        close() {}
      };

      unregisterCDPClient(targetId);
      registerCDPClient(targetId, mockClient as any);

      // Note: Full networkidle testing requires precise timing of 500ms quiet period.
      // This test verifies the code path and that Network.enable is called.
      // The implementation polls every 100ms checking for 500ms of inactivity.
      const result = await browser_navigate({
        target: targetId,
        url: testUrl,
        waitFor: 'networkidle'
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe(testUrl);
    }, 10000);
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

    it('times out after 30 seconds', async () => {
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

      await expect(
        browser_navigate({
          target: targetId,
          url: testUrl,
          waitFor: 'load'
        })
      ).rejects.toThrow('Timeout');
    }, 35000); // 35 second test timeout to allow for 30s navigation timeout
  });
});
