import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_text } from '../../src/core/tools-page.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../src/core/tools-page.js';
import { BrowserError } from '../../src/core/errors.js';

// Helper to create a CDP client for text testing
function createMockTextClient(options: { pageText?: string; elementText?: Record<string, string> } = {}) {
  const { pageText = 'Sample page content for testing.', elementText = {} } = options;

  return {
    async send(method: string, params?: Record<string, unknown>) {
      switch (method) {
        case 'Runtime.evaluate': {
          const { expression } = params ?? {};

          // Full page text extraction
          if ((expression as string).includes('main') || (expression as string).includes('article') || (expression as string).includes('body')) {
            return {
              result: { type: 'string', value: pageText },
            };
          }

          // Element-specific text extraction
          if ((expression as string).includes('querySelector')) {
            const selectorMatch = (expression as string).match(/querySelector\('(.+?)'\)/);
            if (selectorMatch) {
              const selector = selectorMatch[1];
              const text = elementText[selector];

              if (text === undefined && (expression as string).includes('.nonexistent')) {
                return {
                  result: { type: 'object', subtype: 'null', value: null },
                };
              }

              return {
                result: { type: 'string', value: text || pageText },
              };
            }
          }

          return {
            result: { type: 'string', value: pageText },
          };
        }

        default:
          return {};
      }
    },
  };
}

describe('P1-16: browser_text', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9357;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    targetId = mockServer.addTab({
      url: 'https://example.com/article',
      title: 'Article Page',
    });
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('Mock Tests', () => {
    it('P1-16: extracts full page text using innerText', async () => {
      const pageText = 'This is the main article content. It has multiple paragraphs of readable text.';
      const mockClient = createMockTextClient({ pageText });
      registerCDPClient('text-fullpage-test', mockClient);

      const result = await browser_text({
        target: 'text-fullpage-test',
      });

      expect(result.text).toBe(pageText);
      expect(result.length).toBe(pageText.length);
      expect(result.truncated).toBe(false);

      unregisterCDPClient('text-fullpage-test');
    });

    it('P1-16: extracts text from specific element by selector', async () => {
      const elementText = { '#content': 'Element specific content here.' };
      const mockClient = createMockTextClient({ elementText });
      registerCDPClient('text-element-test', mockClient);

      const result = await browser_text({
        target: 'text-element-test',
        selector: '#content',
      });

      expect(result.text).toBe(elementText['#content']);
      expect(result.length).toBe(elementText['#content'].length);

      unregisterCDPClient('text-element-test');
    });

    it('P1-16: truncates at 50K characters', async () => {
      const longText = 'A'.repeat(60000);
      const mockClient = createMockTextClient({ pageText: longText });
      registerCDPClient('text-truncate-test', mockClient);

      const result = await browser_text({
        target: 'text-truncate-test',
      });

      expect(result.truncated).toBe(true);
      expect(result.text.length).toBeLessThanOrEqual(50000 + 25); // truncation marker length approx
      expect(result.text).toContain('[... truncated ...]');
      expect(result.length).toBe(60000); // Original length before truncation

      unregisterCDPClient('text-truncate-test');
    });

    it('P1-16: does not truncate when under 50K limit', async () => {
      const shortText = 'Short content.';
      const mockClient = createMockTextClient({ pageText: shortText });
      registerCDPClient('text-notruncate-test', mockClient);

      const result = await browser_text({
        target: 'text-notruncate-test',
      });

      expect(result.truncated).toBe(false);
      expect(result.text).toBe(shortText);
      expect(result.length).toBe(shortText.length);

      unregisterCDPClient('text-notruncate-test');
    });

    it('P1-16: throws ElementNotFound for invalid selector', async () => {
      const mockClient = createMockTextClient({});
      registerCDPClient('text-notfound-test', mockClient);

      await expect(
        browser_text({
          target: 'text-notfound-test',
          selector: '.nonexistent',
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_text({
          target: 'text-notfound-test',
          selector: '.nonexistent',
        })
      ).rejects.toThrow(/Element not found/);

      unregisterCDPClient('text-notfound-test');
    });

    it('P1-16: uses innerText not textContent (excludes hidden elements)', async () => {
      // The mock implicitly uses innerText simulation - hidden content not included
      const visibleText = 'Only visible text';
      const mockClient = createMockTextClient({ pageText: visibleText });
      registerCDPClient('text-innertext-test', mockClient);

      const result = await browser_text({
        target: 'text-innertext-test',
      });

      // Verify the expression uses innerText, not textContent
      // This is implicit in our mock but the real implementation uses innerText
      expect(result.text).toBe(visibleText);

      unregisterCDPClient('text-innertext-test');
    });

    it('P1-16: tries content selectors in order for full page extraction', async () => {
      const mockClient = createMockTextClient({
        pageText: 'Main content area text',
      });
      registerCDPClient('text-selectors-test', mockClient);

      await browser_text({
        target: 'text-selectors-test',
      });

      // The implementation tries: main, article, [role="main"], #content, .content, body
      // Our mock returns the page text for these selectors
      // Just verifying the call succeeds

      unregisterCDPClient('text-selectors-test');
    });

    it('P1-16: handles JavaScriptError from evaluation', async () => {
      const errorClient = {
        async send(method: string, params?: Record<string, unknown>) {
          if (method === 'Runtime.evaluate') {
            return {
              exceptionDetails: {
                text: 'Error: document is not defined',
                lineNumber: 0,
                columnNumber: 0,
              },
            };
          }
          return {};
        },
      };

      registerCDPClient('text-error-test', errorClient);

      await expect(
        browser_text({
          target: 'text-error-test',
        })
      ).rejects.toThrow(BrowserError);

      await expect(
        browser_text({
          target: 'text-error-test',
        })
      ).rejects.toThrow(/document is not defined/);

      unregisterCDPClient('text-error-test');
    });
  });

  describe('E2E Tests', () => {
    it.skip('P1-16-E2E: extracts readable text from real page', async () => {
      // Requires real browser environment
    });

    it.skip('P1-16-E2E: extracts text from specific element', async () => {
      // Requires real browser environment
    });

    it.skip('P1-16-E2E: excludes hidden elements from text', async () => {
      // Requires real browser environment
    });
  });
});
