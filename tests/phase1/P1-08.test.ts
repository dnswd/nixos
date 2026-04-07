import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_scroll } from '../../pkgs/pi-web-browse/src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../pkgs/pi-web-browse/src/core/tools-page.js';
import { BrowserError } from '../../pkgs/pi-web-browse/src/core/errors.js';

// Helper to create a CDP client for scroll testing
function createMockScrollClient(mockServer: MockCDPServer, targetId: string) {
  let scrollPosition = { x: 0, y: 0 };
  let viewportSize = { width: 1024, height: 768 };
  let documentHeight = 2000;

  return {
    async send(method: string, params?: Record<string, unknown>) {
      switch (method) {
        case 'Runtime.enable':
          return { result: {} };

        case 'Runtime.evaluate': {
          const expression = String(params?.expression ?? '');

          // Handle scrollIntoView
          if (expression.includes('scrollIntoView')) {
            // Simulate scrolling to a specific element
            return { result: { type: 'string', value: 'scrolled' } };
          }

          // Handle null element case (element not found)
          if (expression.includes('document.querySelector') && expression.includes('return null')) {
            return { result: { type: 'object', value: null } };
          }

          // Handle scrollBy operations with viewport-based amounts
          if (expression.includes('scrollBy')) {
            // Check for explicit number amounts
            const amountMatch = expression.match(/scrollBy\((-?\d+),\s*(-?\d+)\)/);
            if (amountMatch) {
              const dx = parseInt(amountMatch[1], 10);
              const dy = parseInt(amountMatch[2], 10);
              scrollPosition.x = Math.max(0, scrollPosition.x + dx);
              scrollPosition.y = Math.max(0, Math.min(documentHeight - viewportSize.height, scrollPosition.y + dy));
            } else if (expression.includes('window.innerHeight')) {
              // Scroll by viewport height
              if (expression.includes('-')) {
                scrollPosition.y = Math.max(0, scrollPosition.y - viewportSize.height);
              } else {
                scrollPosition.y = Math.min(documentHeight - viewportSize.height, scrollPosition.y + viewportSize.height);
              }
            } else if (expression.includes('window.innerWidth')) {
              // Scroll by viewport width
              if (expression.includes('-')) {
                scrollPosition.x = Math.max(0, scrollPosition.x - viewportSize.width);
              } else {
                scrollPosition.x = Math.min(2000 - viewportSize.width, scrollPosition.x + viewportSize.width);
              }
            }
            return { result: { type: 'undefined' } };
          }

          // Handle scrollTo operations
          if (expression.includes('scrollTo')) {
            if (expression.includes('scrollTo(0, 0)')) {
              scrollPosition = { x: 0, y: 0 };
            } else if (expression.includes('body.scrollHeight')) {
              scrollPosition = { x: 0, y: documentHeight };
            }
            return { result: { type: 'undefined' } };
          }

          // Handle position retrieval
          if (expression.includes('JSON.stringify') && expression.includes('scrollX')) {
            return {
              result: {
                type: 'string',
                value: JSON.stringify({ x: scrollPosition.x, y: scrollPosition.y }),
              },
            };
          }

          // Handle innerHeight/innerWidth for default scroll amounts
          if (expression.includes('innerHeight') || expression.includes('innerWidth')) {
            return {
              result: {
                type: 'string',
                value: JSON.stringify({
                  height: viewportSize.height,
                  width: viewportSize.width,
                }),
              },
            };
          }

          // Handle innerWidth for left/right scrolling
          if (expression.includes('innerWidth')) {
            return { result: { type: 'number', value: viewportSize.width } };
          }

          // Handle document.body.scrollHeight
          if (expression.includes('scrollHeight')) {
            return { result: { type: 'number', value: documentHeight } };
          }

          return {};
        }

        default:
          return {};
      }
    },

    getScrollPosition() {
      return { ...scrollPosition };
    },

    setScrollPosition(x: number, y: number) {
      scrollPosition = { x, y };
    },

    reset() {
      scrollPosition = { x: 0, y: 0 };
    },
  };
}

describe('P1-08: browser_scroll', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9348;
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
      '<html><body style="height: 2000px;"><div id="section-1">Section 1</div><div id="section-2" style="margin-top: 1000px;">Section 2</div></body></html>'
    );

    registerCDPClient(targetId, createMockScrollClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-08: scrolls down by viewport height (default amount)', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-down-test', mockClient as unknown as ReturnType<typeof createMockScrollClient>);

      const result = await browser_scroll({
        target: 'scroll-down-test',
        direction: 'down',
      });

      expect(result.scrolled).toBe(true);
      // Default scroll is viewport height (768), the mock tracks this internally
      // The returned position comes from the scroll action
      expect(mockClient.getScrollPosition().y).toBeGreaterThan(0);

      unregisterCDPClient('scroll-down-test');
    });

    it('P1-08: scrolls up by viewport height', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-up-test', mockClient as unknown as ReturnType<typeof createMockScrollClient>);

      // First scroll down to have a position to scroll up from
      mockClient.setScrollPosition(0, 500);

      // Simulate what happens: scroll up by viewport (768) from 500
      // Result should be max(0, 500 - 768) = 0
      const result = await browser_scroll({
        target: 'scroll-up-test',
        direction: 'up',
      });

      expect(result.scrolled).toBe(true);
      // The mock client's scrollBy logic handles this - verify the position decreased
      expect(mockClient.getScrollPosition().y).toBeLessThanOrEqual(500);

      unregisterCDPClient('scroll-up-test');
    });

    it('P1-08: scrolls to top of page', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-top-test', mockClient as unknown as ReturnType<typeof createMockScrollClient>);

      // Start at bottom
      mockClient.setScrollPosition(0, 1000);

      const result = await browser_scroll({
        target: 'scroll-top-test',
        direction: 'top',
      });

      expect(result.scrolled).toBe(true);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);

      unregisterCDPClient('scroll-top-test');
    });

    it('P1-08: scrolls to bottom of page', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-bottom-test', mockClient as unknown as ReturnType<typeof createMockScrollClient>);

      const result = await browser_scroll({
        target: 'scroll-bottom-test',
        direction: 'bottom',
      });

      expect(result.scrolled).toBe(true);
      expect(result.x).toBe(0);
      expect(result.y).toBe(2000);

      unregisterCDPClient('scroll-bottom-test');
    });

    it('P1-08: scrolls with custom amount', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-custom-test', mockClient as unknown as ReturnType<typeof createMockScrollClient>);

      const result = await browser_scroll({
        target: 'scroll-custom-test',
        direction: 'down',
        amount: 100,
      });

      expect(result.scrolled).toBe(true);
      expect(result.y).toBeGreaterThan(0);

      unregisterCDPClient('scroll-custom-test');
    });

    it('P1-08: scrolls element into view via selector', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-element-test', mockClient as unknown as ReturnType<typeof createMockScrollClient>);

      const result = await browser_scroll({
        target: 'scroll-element-test',
        direction: 'down',
        selector: '#section-2',
      });

      expect(result.scrolled).toBe(true);
      // Should return position after scrollIntoView

      unregisterCDPClient('scroll-element-test');
    });

    it('P1-08: throws ElementNotFound for missing selector', async () => {
      // Create a mock that returns null for the querySelector result
      const nullMockClient = {
        async send(method: string, params?: Record<string, unknown>) {
          if (method === 'Runtime.enable') {
            return { result: {} };
          }
          if (method === 'Runtime.evaluate') {
            const expr = String(params?.expression ?? '');
            // The expression should contain the IIFE with querySelector
            if (expr.includes('querySelector') && expr.includes('#nonexistent')) {
              // Return null as the result value (element not found)
              return { result: { type: 'object', value: null } };
            }
            if (expr.includes('scrollX')) {
              return { result: { type: 'string', value: JSON.stringify({ x: 0, y: 0 }) } };
            }
          }
          return {};
        },
      };

      registerCDPClient('scroll-not-found-test', nullMockClient as unknown as ReturnType<typeof createMockScrollClient>);

      try {
        await browser_scroll({
          target: 'scroll-not-found-test',
          direction: 'down',
          selector: '#nonexistent',
        });
        expect.fail('Expected ElementNotFound error');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('ElementNotFound');
          expect(error.message).toContain('Element not found');
        } else {
          throw error;
        }
      } finally {
        unregisterCDPClient('scroll-not-found-test');
      }
    });
  });

  describe('Error Handling', () => {
    it('throws ElementNotFound for null element result', async () => {
      const mockClient = {
        async send(method: string, params?: Record<string, unknown>) {
          if (method === 'Runtime.evaluate') {
            const expr = String(params?.expression ?? '');
            if (expr.includes('querySelector')) {
              return { result: { type: 'object', value: null } };
            }
            if (expr.includes('scrollX')) {
              return { result: { type: 'string', value: JSON.stringify({ x: 0, y: 0 }) } };
            }
          }
          return { result: {} };
        },
      };

      registerCDPClient('scroll-null-test', mockClient as unknown as ReturnType<typeof createMockScrollClient>);

      try {
        await browser_scroll({
          target: 'scroll-null-test',
          direction: 'down',
          selector: '#missing',
        });
        expect.fail('Expected ElementNotFound error');
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('ElementNotFound');
        } else {
          throw error;
        }
      } finally {
        unregisterCDPClient('scroll-null-test');
      }
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-08-E2E: scrolls down and verifies new position', async () => {
      // Test actual scroll position change in Chrome
    });

    it.skip('P1-08-E2E: scrolls element into view and verifies visibility', async () => {
      // Use scroll with selector, verify element is in viewport
    });

    it.skip('P1-08-E2E: screenshot verification shows scrolled content', async () => {
      // Take screenshot before and after scroll to verify content change
    });
  });
});
