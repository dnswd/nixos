import { BrowserError } from './errors.js';

// CDP Client interface for sending commands to Chrome DevTools Protocol
export interface CDPClient {
  send(method: string, params?: Record<string, unknown>): Promise<{
    result?: {
      value?: unknown;
      type?: string;
    };
    exceptionDetails?: {
      text: string;
      lineNumber?: number;
      columnNumber?: number;
    };
  }>;
}

// Map to store CDP clients per target
const cdpClients = new Map<string, CDPClient>();

/**
 * Get or create a CDP client for a target.
 * In real implementation, this connects to the browser's CDP endpoint.
 */
export async function getCDPClient(target: string): Promise<CDPClient> {
  // For mock/testing, return a client that delegates to the mock server
  if (!cdpClients.has(target)) {
    throw new BrowserError('TabNotFound', `No CDP client available for target: ${target}`);
  }
  return cdpClients.get(target)!;
}

/**
 * Register a CDP client for a target (used by tests and daemon).
 */
export function registerCDPClient(target: string, client: CDPClient): void {
  cdpClients.set(target, client);
}

/**
 * Unregister a CDP client for a target.
 */
export function unregisterCDPClient(target: string): void {
  cdpClients.delete(target);
}

// HTML extraction result type
export interface HTMLResult {
  html: string;
  length: number;
  truncated: boolean;
}

/**
 * Extract HTML from a page.
 * @param target - The target tab ID
 * @param selector - Optional CSS selector to extract specific element HTML
 * @returns HTML content with metadata
 */
export async function browser_html({
  target,
  selector,
}: {
  target: string;
  selector?: string;
}): Promise<HTMLResult> {
  const cdp = await getCDPClient(target);

  const expression = selector
    ? `document.querySelector('${selector}')?.outerHTML || null`
    : 'document.documentElement.outerHTML';

  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });

  if (exceptionDetails) {
    throw new BrowserError('JavaScriptError', exceptionDetails.text, {
      line: exceptionDetails.lineNumber,
      column: exceptionDetails.columnNumber,
    });
  }

  if (result?.value === null) {
    throw new BrowserError('ElementNotFound', `Element not found: "${selector}"`, {
      selector,
    });
  }

  const htmlValue = String(result?.value ?? '');
  let html = htmlValue;
  let truncated = false;
  const MAX_LENGTH = 50000;

  if (html.length > MAX_LENGTH) {
    html = html.slice(0, MAX_LENGTH) + '\n<!-- ... truncated ... -->';
    truncated = true;
  }

  return { html, length: htmlValue.length, truncated };
}

// Screenshot result type
export interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
  dpr: number;
  cssWidth: number;
  cssHeight: number;
}

// Text extraction result type
export interface TextResult {
  text: string;
  length: number;
  truncated: boolean;
}

/**
 * Extract clean text content (readability-style) from page or element.
 * @param target - The target tab ID
 * @param selector - Optional CSS selector to extract text from specific element
 * @returns Text content with metadata
 */
export async function browser_text({
  target,
  selector,
}: {
  target: string;
  selector?: string;
}): Promise<TextResult> {
  const cdp = await getCDPClient(target);

  const expression = selector
    ? `(() => { const el = document.querySelector('${selector}'); return el ? el.innerText.trim() : null; })()`
    : `
      (function() {
        // Simple readability: get main content area
        const selectors = ['main', 'article', '[role="main"]', '#content', '.content', 'body'];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText) {
            return el.innerText.trim();
          }
        }
        return '';
      })()
    `;

  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });

  if (exceptionDetails) {
    throw new BrowserError('JavaScriptError', exceptionDetails.text, {
      line: exceptionDetails.lineNumber,
      column: exceptionDetails.columnNumber,
    });
  }

  if (selector && result?.value === null) {
    throw new BrowserError('ElementNotFound', `Element not found: "${selector}"`, {
      selector,
    });
  }

  let text = String(result?.value ?? '');
  let truncated = false;
  const MAX_LENGTH = 50000;

  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH) + '\n\n[... truncated ...]';
    truncated = true;
  }

  return {
    text,
    length: result?.value?.length || 0,
    truncated,
  };
}

/**
 * Capture a screenshot of a page.
 * Placeholder for D1.1 implementation.
 */
export async function browser_shot({
  target,
}: {
  target: string;
  fullPage?: boolean;
}): Promise<ScreenshotResult> {
  const cdp = await getCDPClient(target);

  // Get DPR from the page
  const dprResult = await cdp.send('Runtime.evaluate', {
    expression: 'window.devicePixelRatio',
    returnByValue: true,
  });
  const dpr = Number(dprResult.result?.value ?? 1);

  // Capture screenshot
  const { result } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
  });

  const data = String(result?.data ?? '');

  // For now, return mock dimensions based on DPR
  // In real implementation, decode PNG and get actual dimensions
  const cssWidth = 1024;
  const cssHeight = 768;
  const width = Math.round(cssWidth * dpr);
  const height = Math.round(cssHeight * dpr);

  return {
    path: `/tmp/screenshot-${target}.png`,
    width,
    height,
    dpr,
    cssWidth,
    cssHeight,
  };
}
