import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_scroll } from '../../src/core/tools-dom.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';
import { BrowserError } from '../../src/core/errors.js';

// Helper to create a CDP client for scroll testing
function createMockScrollClient(mockServer: MockCDPServer, targetId: string) {
  let scrollX = 0;
  let scrollY = 0;
  let elementScrolled: string | null = null;

  return {
    async send(method: string, params?: Record<string, unknown>) {
      switch (method) {
        case 'Runtime.evaluate': {
          const { expression } = params ?? {};

          // Simulate scrollIntoView for element scrolling
          if ((expression as string).includes('scrollIntoView')) {
            const selectorMatch = (expression as string).match(/querySelector\('(.+?)'\)/);
            if (selectorMatch) {
              elementScrolled = selectorMatch[1];
            }
            return {
              result: { type: 'string', value: 'scrolled' },
            };
          }

          // Simulate element not found - return actual null which browser_eval serializes to 'null' string
          if ((expression as string).includes('.nonexistent')) {
            // When browser_eval receives { type: 'object', subtype: 'null' }, it returns result: 'null'
            // Then browser_scroll checks if result.result === 'null'
            return {
              result: { type: 'object', subtype: 'null', value: null },
            };
          }

          // Simulate page scroll operations
          if ((expression as string).includes('window.scrollBy')) {
            // Parse the scroll amount
            const match = (expression as string).match(/scrollBy\((-?\d+), (-?\d+)\)/);
            if (match) {
              scrollX += parseInt(match[1], 10);
              scrollY += parseInt(match[2], 10);
            }
          }

          if ((expression as string).includes('window.scrollTo')) {
            if ((expression as string).includes('scrollTo(0, 0)')) {
              scrollX = 0;
              scrollY = 0;
            } else if ((expression as string).includes('scrollHeight')) {
              scrollY = 5000; // Simulate bottom of page
            }
          }

          // Return current scroll position
          if ((expression as string).includes('window.scrollX') && (expression as string).includes('window.scrollY')) {
            return {
              result: { type: 'string', value: JSON.stringify({ x: scrollX, y: scrollY }) },
            };
          }

          return { result: { type: 'undefined' } };
        }

        default:
          return {};
      }
    },

    getScrollPosition() {
      return { x: scrollX, y: scrollY };
    },

    getElementScrolled() {
      return elementScrolled;
    },
  };
}

describe('P1-14: browser_scroll', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9356;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    targetId = mockServer.addTab({
      url: 'https://example.com',
      title: 'Test Page',
    });

    registerCDPClient(targetId, createMockScrollClient(mockServer, targetId));
  });

  afterAll(async () => {
    unregisterCDPClient(targetId);
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-14: scrolls down by viewport amount', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-down-test', mockClient);

      const result = await browser_scroll({
        target: 'scroll-down-test',
        direction: 'down',
      });

      expect(result.scrolled).toBe(true);

      unregisterCDPClient('scroll-down-test');
    });

    it('P1-14: scrolls up by viewport amount', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-up-test', mockClient);

      const result = await browser_scroll({
        target: 'scroll-up-test',
        direction: 'up',
      });

      expect(result.scrolled).toBe(true);

      unregisterCDPClient('scroll-up-test');
    });

    it('P1-14: scrolls left by viewport width', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-left-test', mockClient);

      const result = await browser_scroll({
        target: 'scroll-left-test',
        direction: 'left',
      });

      expect(result.scrolled).toBe(true);

      unregisterCDPClient('scroll-left-test');
    });

    it('P1-14: scrolls right by viewport width', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-right-test', mockClient);

      const result = await browser_scroll({
        target: 'scroll-right-test',
        direction: 'right',
      });

      expect(result.scrolled).toBe(true);

      unregisterCDPClient('scroll-right-test');
    });

    it('P1-14: scrolls to top of page', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-top-test', mockClient);

      const result = await browser_scroll({
        target: 'scroll-top-test',
        direction: 'top',
      });

      expect(result.scrolled).toBe(true);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);

      unregisterCDPClient('scroll-top-test');
    });

    it('P1-14: scrolls to bottom of page', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-bottom-test', mockClient);

      const result = await browser_scroll({
        target: 'scroll-bottom-test',
        direction: 'bottom',
      });

      expect(result.scrolled).toBe(true);
      expect(result.x).toBe(0);
      expect(result.y).toBe(5000);

      unregisterCDPClient('scroll-bottom-test');
    });

    it('P1-14: scrolls element into view by selector', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-element-test', mockClient);

      const result = await browser_scroll({
        target: 'scroll-element-test',
        direction: 'down',
        selector: '#section-1',
      });

      expect(result.scrolled).toBe(true);
      expect(mockClient.getElementScrolled()).toBe('#section-1');

      unregisterCDPClient('scroll-element-test');
    });

    it('P1-14: throws ElementNotFound for invalid selector', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-notfound-test', mockClient);

      await expect(
        browser_scroll({
          target: 'scroll-notfound-test',
          direction: 'down',
          selector: '.nonexistent',
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_scroll({
          target: 'scroll-notfound-test',
          direction: 'down',
          selector: '.nonexistent',
        })
      ).rejects.toThrow(/Element not found/);

      unregisterCDPClient('scroll-notfound-test');
    });

    it('P1-14: returns current scroll position', async () => {
      const mockClient = createMockScrollClient(mockServer, targetId);
      registerCDPClient('scroll-position-test', mockClient);

      const result = await browser_scroll({
        target: 'scroll-position-test',
        direction: 'down',
      });

      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');

      unregisterCDPClient('scroll-position-test');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-14-E2E: scrolls a real page', async () => {
      // Requires real browser environment
    });

    it.skip('P1-14-E2E: scrolls element into view', async () => {
      // Requires real browser environment
    });

    it.skip('P1-14-E2E: respects custom amount parameter', async () => {
      // Requires real browser environment
    });
  });
});
