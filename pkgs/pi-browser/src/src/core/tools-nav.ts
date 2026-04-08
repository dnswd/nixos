import { getCDPClient } from './cdp-client.js';
import { getBrowserWsUrl } from './browser-discovery.js';
import { BrowserError } from './errors.js';

// Sleep utility for wait delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Tab info from Target.getTargets
export interface TabInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
}

/**
 * List all open browser tabs.
 * Auto-discovers Chrome, Brave, Edge, Chromium, Vivaldi via DevToolsActivePort.
 * @returns Array of tab info
 */
export async function browser_list(): Promise<TabInfo[]> {
  try {
    // Get browser-level CDP client (no target attachment needed for browser-level commands)
    const browserWsUrl = await getBrowserWsUrl();
    const { default: WebSocket } = await import('ws');
    const ws = new WebSocket(browserWsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // Send Target.getTargets
    const requestId = 1;
    ws.send(JSON.stringify({
      id: requestId,
      method: 'Target.getTargets',
      params: {}
    }));

    // Wait for response
    const response_data = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
      ws.on('message', (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
      });
    });

    ws.close();

    if (response_data.error) {
      throw new Error(response_data.error.message);
    }

    // Filter to page targets only (exclude chrome:// URLs and non-page types)
    return response_data.result.targetInfos
      .filter((t: any) => t.type === 'page' && !t.url.startsWith('chrome://'))
      .map((t: any) => ({
        id: t.targetId,
        url: t.url,
        title: t.title,
        active: t.active || false
      }));
  } catch (error) {
    // Browser not found or connection failed
    if (error instanceof Error && (
      error.message.includes('No DevToolsActivePort found') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('fetch failed') ||
      error.message.includes('ECONNRESET')
    )) {
      throw new BrowserError(
        'BrowserNotFound',
        'No browser with remote debugging found. Enable remote debugging:\n' +
        '- Chrome/Edge: open chrome://inspect/#remote-debugging\n' +
        '- Brave: open brave://inspect/#remote-debugging\n' +
        'Then toggle the switch to enable debugging.'
      );
    }
    throw error;
  }
}

// Navigation result
export interface NavigateResult {
  success: boolean;
  url: string;
  title: string;
}

/**
 * Navigate to a URL in a browser tab.
 * @param target - The target tab ID
 * @param url - URL to navigate to
 * @param waitFor - Wait condition: 'load', 'domcontentloaded', or 'networkidle'
 * @returns Navigation result with final URL and title
 */
export async function browser_navigate({
  target,
  url,
  waitFor = 'load'
}: {
  target: string;
  url: string;
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
}): Promise<NavigateResult> {
  const cdp = await getCDPClient(target, true);

  // Enable Page domain
  await cdp.send('Page.enable');

  // Navigate
  const { frameId, errorText } = await cdp.send('Page.navigate', { url });

  // Check for navigation errors
  if (errorText) {
    throw new Error(`Navigation failed: ${errorText}`);
  }

  // Wait for condition
  if (waitFor === 'load') {
    await waitForEvent(cdp, 'Page.loadEventFired', 30000);
  } else if (waitFor === 'domcontentloaded') {
    await waitForEvent(cdp, 'Page.domContentEventFired', 30000);
  } else if (waitFor === 'networkidle') {
    await waitForNetworkIdle(cdp, 500, 30000);
  }

  // Get final URL and title
  const { result: urlResult } = await cdp.send('Runtime.evaluate', {
    expression: 'window.location.href',
    returnByValue: true
  });

  const { result: titleResult } = await cdp.send('Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true
  });

  return {
    success: true,
    url: urlResult?.value || url,
    title: titleResult?.value || ''
  };
}

// Helper: wait for CDP event
function waitForEvent(cdp: any, eventName: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${eventName}`)), timeout);
    cdp.on(eventName, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// Helper: wait for network idle
function waitForNetworkIdle(cdp: any, quietPeriod: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let lastActivity = Date.now();
    let checkInterval: NodeJS.Timeout;

    const timeoutTimer = setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error('Timeout waiting for network idle'));
    }, timeout);

    cdp.on('Network.requestWillBeSent', () => { lastActivity = Date.now(); });
    cdp.on('Network.responseReceived', () => { lastActivity = Date.now(); });

    checkInterval = setInterval(() => {
      if (Date.now() - lastActivity >= quietPeriod) {
        clearTimeout(timeoutTimer);
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
}

// Snap result
export interface SnapResult {
  tree: string;
  interactiveElements: Array<{
    role: string;
    name: string;
    selector?: string;
  }>;
}

/**
 * Capture accessibility tree of a page.
 * @param target - The target tab ID
 * @param compact - If true, return only interactive elements
 * @returns Accessibility tree and interactive elements
 */
export async function browser_snap({
  target,
  compact = true
}: {
  target: string;
  compact?: boolean;
}): Promise<SnapResult> {
  const cdp = await getCDPClient(target, true);

  // Enable Accessibility domain
  await cdp.send('Accessibility.enable');

  // Get full accessibility tree
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');

  // Find interactive elements
  const interactiveElements = nodes
    .filter((n: any) => isInteractiveRole(n.role?.value))
    .map((n: any) => ({
      role: n.role?.value,
      name: n.name?.value,
      selector: generateSelectorHint(n)
    }));

  if (compact) {
    // Compact format: [role] "name"
    const tree = interactiveElements
      .map((e: any) => `[${e.role}] "${e.name}"`)
      .join('\n');
    return { tree, interactiveElements };
  } else {
    // Full format would include all nodes recursively
    const tree = formatFullTree(nodes);
    return { tree, interactiveElements };
  }
}

// Helper: check if role is interactive
function isInteractiveRole(role?: string): boolean {
  if (!role) return false;
  const interactiveRoles = [
    'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
    'menu', 'menuitem', 'tab', 'treeitem', 'listitem', 'heading',
    'searchbox', 'spinbutton', 'slider', 'switch'
  ];
  return interactiveRoles.includes(role.toLowerCase());
}

// Helper: generate selector hint
function generateSelectorHint(node: any): string {
  // Simple hint generation
  if (node.backendDOMNodeId) {
    return `#element-${node.backendDOMNodeId}`;
  }
  return '';
}

// Helper: format full tree recursively
function formatFullTree(nodes: any[], nodeId?: number, indent = 0): string {
  const node = nodes.find((n: any) => n.nodeId === nodeId);
  if (!node && nodeId) return '';

  const current = node || nodes[0];
  const role = current.role?.value || 'generic';
  const name = current.name?.value || '';

  const line = '  '.repeat(indent) + `[${role}]${name ? ` "${name}"` : ''}`;

  const childIds = current.childIds || [];
  const childLines = childIds
    .map((cid: number) => formatFullTree(nodes, cid, indent + 1))
    .filter(Boolean);

  return [line, ...childLines].join('\n');
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
