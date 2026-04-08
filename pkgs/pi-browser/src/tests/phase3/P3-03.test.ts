import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const CACHE_DIR = path.join(homedir(), '.cache', 'pi-browser');
const SOCKETS_DIR = path.join(CACHE_DIR, 'sockets');
const MUTEX_DIR = path.join(CACHE_DIR, 'mutex');
const TEST_PORT = 9335;

// Track stopped tabs for assertions
const stoppedTabs: string[] = [];

// Mock daemon module BEFORE importing tools-tab
vi.mock('../../src/core/daemon.js', () => ({
  startDaemon: vi.fn(async (tabId: string) => {
    // Create mock socket file
    if (process.platform !== 'win32') {
      const socketPath = path.join(SOCKETS_DIR, `${tabId}.sock`);
      if (!fs.existsSync(SOCKETS_DIR)) {
        fs.mkdirSync(SOCKETS_DIR, { recursive: true });
      }
      fs.writeFileSync(socketPath, '');
    }
  }),
  stopDaemon: vi.fn(async (tabId: string) => {
    stoppedTabs.push(tabId);
    const socketPath = path.join(SOCKETS_DIR, `${tabId}.sock`);
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
  }),
  getSocketPath: vi.fn((tabId: string) => {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\pi-browser-${tabId}`;
    }
    return path.join(SOCKETS_DIR, `${tabId}.sock`);
  }),
}));

// Mock mutex to prevent file-based locking hangs
vi.mock('../../src/core/mutex.js', () => ({
  acquireMutex: vi.fn().mockResolvedValue(undefined),
  releaseMutex: vi.fn().mockResolvedValue(undefined),
  isMutexHeld: vi.fn().mockReturnValue(false),
}));

// Now import the rest
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_tab_open, browser_tab_close } from '../../src/core/tools-tab.js';

describe('P3-03: tab_close kills daemon and cleans up', () => {
  let mockServer: MockCDPServer;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Clear stopped tabs tracking
    stoppedTabs.length = 0;
    
    originalEnv = process.env.CDP_WS_URL;
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();
    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;

    if (!fs.existsSync(SOCKETS_DIR)) {
      fs.mkdirSync(SOCKETS_DIR, { recursive: true });
    }
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (originalEnv) {
      process.env.CDP_WS_URL = originalEnv;
    } else {
      delete process.env.CDP_WS_URL;
    }
    await mockServer.stop();

    // Clean up socket files
    try {
      if (fs.existsSync(SOCKETS_DIR)) {
        const files = fs.readdirSync(SOCKETS_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(SOCKETS_DIR, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
    
    // Clean up mutex lock files
    try {
      if (fs.existsSync(MUTEX_DIR)) {
        const files = fs.readdirSync(MUTEX_DIR);
        for (const file of files) {
          try { fs.unlinkSync(path.join(MUTEX_DIR, file)); } catch {}
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('returns closed=true after closing tab', async () => {
    const tab = await browser_tab_open({ url: 'https://close-test.com' });
    const result = await browser_tab_close({ tabId: tab.tabId, allowQuit: true });

    expect(result.closed).toBe(true);
    expect(stoppedTabs).toContain(tab.tabId);
  });

  it('daemon is stopped when tab closes', async () => {
    const tab = await browser_tab_open({ url: 'https://daemon-stop.com' });
    await browser_tab_close({ tabId: tab.tabId, allowQuit: true });

    expect(stoppedTabs).toContain(tab.tabId);
  });

  it('socket file is removed after close (Unix)', async () => {
    if (process.platform === 'win32') {
      return; // Skip on Windows
    }

    const tab = await browser_tab_open({ url: 'https://socket-cleanup.com' });
    const socketPath = path.join(SOCKETS_DIR, `${tab.tabId}.sock`);

    // Verify socket exists before close
    expect(fs.existsSync(socketPath)).toBe(true);

    await browser_tab_close({ tabId: tab.tabId, allowQuit: true });

    // Socket should be gone
    expect(fs.existsSync(socketPath)).toBe(false);
  });

  it('returns newActiveTab when closing non-last tab', async () => {
    // Create two tabs
    const tabA = await browser_tab_open({ url: 'https://multi-a.com' });
    const tabB = await browser_tab_open({ url: 'https://multi-b.com' });

    // Close tab A
    const result = await browser_tab_close({ tabId: tabA.tabId });

    expect(result.closed).toBe(true);
    // Should have a new active tab (tab B)
    expect(result.newActiveTab).toBeDefined();
  });

  it('uses active tab when tabId is omitted', async () => {
    const tab = await browser_tab_open({ url: 'https://active-default.com' });

    // Close without specifying tabId - should use active tab
    const result = await browser_tab_close({ allowQuit: true });

    expect(result.closed).toBe(true);
    expect(stoppedTabs).toContain(tab.tabId);
  });

  it('throws error when closing last tab without allowQuit', async () => {
    // Create and close all tabs except one
    const tab = await browser_tab_open({ url: 'https://last-tab.com' });

    // Try to close without allowQuit (should fail)
    await expect(
      browser_tab_close({ tabId: tab.tabId, allowQuit: false })
    ).rejects.toThrow();
  });
});
