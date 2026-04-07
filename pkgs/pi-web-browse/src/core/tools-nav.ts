import { getCDPClient } from './tools-page.js';

// Sleep utility for wait delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// History navigation result type
export interface HistoryResult {
  success: boolean;
  direction: 'back' | 'forward';
}

/**
 * Navigate back in browser history.
 * @param target - The target tab ID
 * @returns Navigation result
 */
export async function browser_back(target: string): Promise<HistoryResult> {
  const cdp = await getCDPClient(target);

  await cdp.send('Runtime.evaluate', {
    expression: 'history.back()',
    returnByValue: true,
  });

  // Wait briefly for navigation
  await sleep(500);

  return { success: true, direction: 'back' };
}

/**
 * Navigate forward in browser history.
 * @param target - The target tab ID
 * @returns Navigation result
 */
export async function browser_forward(target: string): Promise<HistoryResult> {
  const cdp = await getCDPClient(target);

  await cdp.send('Runtime.evaluate', {
    expression: 'history.forward()',
    returnByValue: true,
  });

  // Wait briefly for navigation
  await sleep(500);

  return { success: true, direction: 'forward' };
}
