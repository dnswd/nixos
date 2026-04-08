import { getCDPClient } from './cdp-client.js';
import { BrowserError, ErrorCode } from './errors.js';
import { acquireMutex, releaseMutex } from './mutex.js';
import { startDaemon, stopDaemon, getSocketPath } from './daemon.js';

// CDP Types for Target domain
interface CreateTargetResponse {
  targetId: string;
}

interface GetTargetsResponse {
  targetInfos: Array<{
    targetId: string;
    url: string;
    title: string;
    type: string;
    active?: boolean;
  }>;
}

// Result types
export interface TabOpenResult {
  tabId: string;
  windowId?: string;
  url: string;
  active: boolean;
  daemonSocket: string;
}

export interface TabSwitchResult {
  success: boolean;
  previousTab?: string;
  newTab: {
    id: string;
    url: string;
    title: string;
  };
}

export interface TabCloseResult {
  closed: boolean;
  newActiveTab?: string;
}

// Cache directory for consistency with other tools
const CACHE_DIR = `${process.env.HOME || process.env.USERPROFILE || '/tmp'}/.cache/pi-browser`;

/**
 * Get the browser-level CDP client (without a specific target).
 * Connects to the browser's WebSocket debugger URL.
 */
async function getBrowserCDPClient(): Promise<{
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  close: () => void;
}> {
  let wsUrl: string;

  if (process.env.CDP_WS_URL) {
    wsUrl = process.env.CDP_WS_URL;
  } else {
    const response = await fetch('http://localhost:9222/json/version');
    const version = await response.json();
    wsUrl = version.webSocketDebuggerUrl;
  }

  const { default: WebSocket } = await import('ws');
  const ws = new WebSocket(wsUrl);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let requestId = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString()) as {
      id?: number;
      result?: unknown;
      error?: { message: string };
    };

    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)!;
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    }
  });

  return {
    send: (method: string, params?: Record<string, unknown>): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const id = ++requestId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));

        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error(`Timeout: ${method}`));
          }
        }, 15000);
      });
    },
    close: () => ws.close(),
  };
}

/**
 * Open a new browser tab and spawn its daemon.
 * @param url - Optional URL to open in the new tab
 * @param activate - Whether to activate the new tab (default: true)
 * @param windowId - Optional window ID to open tab in
 * @returns Tab information including ID, URL, and daemon socket path
 */
export async function browser_tab_open({
  url,
  activate = true,
  windowId,
}: {
  url?: string;
  activate?: boolean;
  windowId?: string;
}): Promise<TabOpenResult> {
  // Acquire mutex for browser-level operations
  const mutexId = 'browser';
  await acquireMutex(mutexId, { timeout: 30000, operation: 'tab_open' });

  try {
    // Connect to browser-level CDP
    const browserCDP = await getBrowserCDPClient();

    try {
      // Create new target (tab)
      const createParams: Record<string, unknown> = {};
      if (url) createParams.url = url;
      if (windowId) createParams.windowId = windowId;

      const result = (await browserCDP.send(
        'Target.createTarget',
        createParams
      )) as CreateTargetResponse;

      const tabId = result.targetId;

      if (!tabId) {
        throw new BrowserError(
          ErrorCode.CDPError,
          'Failed to create target: no targetId returned'
        );
      }

      // Spawn daemon for this tab
      await startDaemon(tabId);

      const daemonSocket = getSocketPath(tabId);

      // Activate if requested
      if (activate) {
        await browserCDP.send('Target.activateTarget', { targetId: tabId });
      }

      // Get tab info for URL and title
      const targetsResult = (await browserCDP.send('Target.getTargets')) as GetTargetsResponse;
      const targetInfo = targetsResult.targetInfos.find(
        (t) => t.targetId === tabId
      );

      return {
        tabId,
        windowId,
        url: targetInfo?.url || url || 'about:blank',
        active: activate,
        daemonSocket,
      };
    } finally {
      browserCDP.close();
      await releaseMutex(mutexId);
    }
  } catch (error) {
    if (error instanceof BrowserError) {
      throw error;
    }
    throw new BrowserError(
      ErrorCode.CDPError,
      `Failed to open tab: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the currently active tab ID.
 * Uses Target.getTargets to find which tab is active.
 */
async function getActiveTabId(): Promise<string | undefined> {
  const browserCDP = await getBrowserCDPClient();

  try {
    const result = (await browserCDP.send('Target.getTargets')) as GetTargetsResponse;

    // Find the active page target
    const activeTarget = result.targetInfos.find(
      (t) => t.type === 'page' && t.active
    );

    return activeTarget?.targetId;
  } finally {
    browserCDP.close();
  }
}

/**
 * Switch to a different tab by activating it.
 * @param tabId - The target tab ID to switch to
 * @returns Switch result with previous and new tab info
 */
export async function browser_tab_switch({
  tabId,
}: {
  tabId: string;
}): Promise<TabSwitchResult> {
  // Acquire mutex for both browser and target tab
  const mutexId = 'browser';
  await acquireMutex(mutexId, { timeout: 30000, operation: 'tab_switch' });

  try {
    // Get current active tab before switching
    const previousTabId = await getActiveTabId();

    // Connect to browser-level CDP
    const browserCDP = await getBrowserCDPClient();

    try {
      // Activate the target
      await browserCDP.send('Target.activateTarget', { targetId: tabId });

      // Get tab info
      const result = (await browserCDP.send('Target.getTargets')) as GetTargetsResponse;
      const targetInfo = result.targetInfos.find((t) => t.targetId === tabId);

      if (!targetInfo) {
        throw new BrowserError(
          ErrorCode.TabNotFound,
          `Tab ${tabId} not found`
        );
      }

      return {
        success: true,
        previousTab: previousTabId,
        newTab: {
          id: tabId,
          url: targetInfo.url,
          title: targetInfo.title,
        },
      };
    } finally {
      browserCDP.close();
      await releaseMutex(mutexId);
    }
  } catch (error) {
    if (error instanceof BrowserError) {
      throw error;
    }
    throw new BrowserError(
      ErrorCode.CDPError,
      `Failed to switch tab: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Close a browser tab and cleanup its daemon.
 * @param tabId - The tab ID to close (uses active tab if omitted)
 * @param allowQuit - Whether to allow closing the last tab (default: false)
 * @returns Close result with new active tab if any
 */
export async function browser_tab_close({
  tabId,
  allowQuit = false,
}: {
  tabId?: string;
  allowQuit?: boolean;
}): Promise<TabCloseResult> {
  // Resolve tab ID (use active if not provided)
  const targetId = tabId || (await getActiveTabId());

  if (!targetId) {
    throw new BrowserError(
      ErrorCode.TabNotFound,
      'No tab specified and no active tab found'
    );
  }

  // Acquire mutex for browser-level operations
  const mutexId = 'browser';
  await acquireMutex(mutexId, { timeout: 30000, operation: 'tab_close' });

  try {
    // Connect to browser-level CDP
    const browserCDP = await getBrowserCDPClient();

    try {
      // Get all tabs before closing to check if this is the last one
      const targetsResult = (await browserCDP.send(
        'Target.getTargets'
      )) as GetTargetsResponse;
      const pageTargets = targetsResult.targetInfos.filter(
        (t) => t.type === 'page'
      );

      // Check if this is the last tab and allowQuit is false
      if (pageTargets.length <= 1 && !allowQuit) {
        throw new BrowserError(
          ErrorCode.TabBusy,
          'Cannot close the last tab. Use allowQuit=true to close anyway.'
        );
      }

      // Close the target
      await browserCDP.send('Target.closeTarget', { targetId });

      // Kill daemon for this tab
      await stopDaemon(targetId);

      // Clean up socket file
      const fs = await import('fs');
      const socketPath = getSocketPath(targetId);
      try {
        if (fs.existsSync(socketPath)) {
          fs.unlinkSync(socketPath);
        }
      } catch {
        // Ignore cleanup errors
      }

      // Find the new active tab if any
      const newTargetsResult = (await browserCDP.send(
        'Target.getTargets'
      )) as GetTargetsResponse;
      const newActiveTarget = newTargetsResult.targetInfos.find(
        (t) => t.type === 'page' && t.active
      );

      return {
        closed: true,
        newActiveTab: newActiveTarget?.targetId,
      };
    } finally {
      browserCDP.close();
      await releaseMutex(mutexId);
    }
  } catch (error) {
    if (error instanceof BrowserError) {
      throw error;
    }
    throw new BrowserError(
      ErrorCode.CDPError,
      `Failed to close tab: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
