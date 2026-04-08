import { getCDPClient, CDPClient } from './cdp-client.js';

/**
 * Result type for browser_wait
 */
export interface WaitResult {
  success: boolean;
  waitedMs: number;
  result?: unknown;
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for various conditions with configurable timeout.
 * @param target - The target tab ID
 * @param type - Type of wait condition
 * @param selector - CSS selector for 'element' wait type
 * @param expression - JavaScript expression for 'function' wait type
 * @param timeout - Maximum wait time in milliseconds (default: 30000)
 * @returns Wait result with success status and actual time waited
 */
export async function browser_wait({
  target,
  type,
  selector,
  expression,
  timeout = 30000,
}: {
  target: string;
  type: 'element' | 'network' | 'navigation' | 'time' | 'function';
  selector?: string;
  expression?: string;
  timeout?: number;
}): Promise<WaitResult> {
  const startTime = Date.now();

  try {
    switch (type) {
      case 'element':
        if (!selector) {
          throw new Error('selector is required for element wait type');
        }
        return await waitForElement(target, selector, timeout, startTime);

      case 'network':
        return await waitForNetworkIdle(target, timeout, startTime);

      case 'navigation':
        return await waitForNavigation(target, timeout, startTime);

      case 'time':
        return await waitForTime(timeout, startTime);

      case 'function':
        if (!expression) {
          throw new Error('expression is required for function wait type');
        }
        return await waitForFunction(target, expression, timeout, startTime);

      default:
        throw new Error(`Unknown wait type: ${type}`);
    }
  } catch (error) {
    // Return failure on timeout or error, don't throw
    const waitedMs = Date.now() - startTime;
    return {
      success: false,
      waitedMs,
      result: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Wait for an element to appear in the DOM using polling.
 */
async function waitForElement(
  target: string,
  selector: string,
  timeout: number,
  startTime: number
): Promise<WaitResult> {
  const cdp = await getCDPClient(target);

  // Enable DOM domain
  await cdp.send('DOM.enable');

  let pollMs = 100;
  let nodeId: number | undefined;

  while (Date.now() - startTime < timeout) {
    try {
      const result = await cdp.send('DOM.querySelector', {
        nodeId: 1, // Document root
        selector,
      }) as { nodeId?: number };

      if (result.nodeId && result.nodeId !== 0) {
        nodeId = result.nodeId;
        break;
      }
    } catch {
      // Continue polling
    }

    await sleep(pollMs);
    // Exponential backoff: 100, 200, 400, max 1000ms
    pollMs = Math.min(pollMs * 2, 1000);
  }

  const waitedMs = Date.now() - startTime;

  if (nodeId) {
    return { success: true, waitedMs, result: nodeId };
  }

  return { success: false, waitedMs };
}

/**
 * Wait for network idle (no activity for 500ms).
 */
async function waitForNetworkIdle(
  target: string,
  timeout: number,
  startTime: number
): Promise<WaitResult> {
  const cdp = await getCDPClient(target, true);

  // Enable Network domain
  await cdp.send('Network.enable');

  // Wait a tick to ensure any pending events from before enable are processed
  await sleep(50);

  let lastActivity = Date.now();
  let pendingRequests = 0;
  let hasSeenActivity = false;

  const onRequestWillBeSent = () => {
    pendingRequests++;
    lastActivity = Date.now();
    hasSeenActivity = true;
  };

  const onLoadingFinished = () => {
    pendingRequests--;
    lastActivity = Date.now();
  };

  cdp.on('Network.requestWillBeSent', onRequestWillBeSent);
  cdp.on('Network.loadingFinished', onLoadingFinished);
  cdp.on('Network.loadingFailed', onLoadingFinished);

  try {
    // Wait for no activity for 500ms
    while (Date.now() - startTime < timeout) {
      if (pendingRequests === 0 && Date.now() - lastActivity >= 500) {
        break;
      }
      await sleep(100);
    }

    const waitedMs = Date.now() - startTime;

    if (pendingRequests === 0 && Date.now() - lastActivity >= 500) {
      return { success: true, waitedMs };
    }

    return { success: false, waitedMs };
  } finally {
    cdp.off('Network.requestWillBeSent', onRequestWillBeSent);
    cdp.off('Network.loadingFinished', onLoadingFinished);
    cdp.off('Network.loadingFailed', onLoadingFinished);
  }
}

/**
 * Wait for page navigation to complete.
 */
async function waitForNavigation(
  target: string,
  timeout: number,
  startTime: number
): Promise<WaitResult> {
  const cdp = await getCDPClient(target, true);

  // Enable Page domain
  await cdp.send('Page.enable');

  return new Promise((resolve) => {
    const timeoutTimer = setTimeout(() => {
      const waitedMs = Date.now() - startTime;
      resolve({ success: false, waitedMs });
    }, timeout);

    cdp.on('Page.loadEventFired', () => {
      clearTimeout(timeoutTimer);
      const waitedMs = Date.now() - startTime;
      resolve({ success: true, waitedMs });
    });
  });
}

/**
 * Wait for a specified duration.
 */
async function waitForTime(
  duration: number,
  startTime: number
): Promise<WaitResult> {
  await sleep(duration);
  const waitedMs = Date.now() - startTime;
  return { success: true, waitedMs };
}

/**
 * Wait for a JavaScript expression to evaluate to a truthy value.
 */
async function waitForFunction(
  target: string,
  expression: string,
  timeout: number,
  startTime: number
): Promise<WaitResult> {
  const cdp = await getCDPClient(target);

  // Enable Runtime domain
  await cdp.send('Runtime.enable');

  let pollMs = 100;
  let result: unknown;
  let found = false;

  while (Date.now() - startTime < timeout) {
    try {
      const evalResult = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      }) as { result?: { value?: unknown; type?: string } };

      const value = evalResult.result?.value;

      // Check if truthy
      if (value !== null && value !== undefined && value !== false && value !== 0 && value !== '') {
        result = value;
        found = true;
        break;
      }
    } catch {
      // Continue polling
    }

    await sleep(pollMs);
    // Exponential backoff: 100, 200, 400, max 1000ms
    pollMs = Math.min(pollMs * 2, 1000);
  }

  const waitedMs = Date.now() - startTime;

  if (found) {
    return { success: true, waitedMs, result };
  }

  return { success: false, waitedMs };
}
