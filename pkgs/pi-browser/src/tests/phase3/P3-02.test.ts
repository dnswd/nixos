import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_tab_open, browser_tab_switch } from '../../src/core/tools-tab.js';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import * as mutexModule from '../../src/core/mutex.js';

const CACHE_DIR = path.join(homedir(), '.cache', 'pi-browser');
const SOCKETS_DIR = path.join(CACHE_DIR, 'sockets');
const MUTEX_DIR = path.join(CACHE_DIR, 'mutex');
const TEST_PORT = 9334;

describe('P3-02: tab_switch activates target tab', () => {
  let mockServer: MockCDPServer;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Mock mutex to prevent file-based locking hangs
    vi.spyOn(mutexModule, 'acquireMutex').mockResolvedValue(undefined);
    vi.spyOn(mutexModule, 'releaseMutex').mockResolvedValue(undefined);
    
    originalEnv = process.env.CDP_WS_URL;
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();
    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;

    if (!fs.existsSync(SOCKETS_DIR)) {
      fs.mkdirSync(SOCKETS_DIR, { recursive: true });
    }

    // Mock daemon functions
    const daemonModule = await import('../../src/core/daemon.js');
    vi.spyOn(daemonModule, 'startDaemon').mockImplementation(async (tabId: string) => {
      if (process.platform !== 'win32') {
        const socketPath = path.join(SOCKETS_DIR, `${tabId}.sock`);
        fs.writeFileSync(socketPath, '');
      }
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalEnv) {
      process.env.CDP_WS_URL = originalEnv;
    } else {
      delete process.env.CDP_WS_URL;
    }
    await mockServer.stop();

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

  it('returns success and new tab info after switch', async () => {
    // Create first tab
    const tabA = await browser_tab_open({ url: 'https://page-a.com', activate: true });

    // Create second tab
    const tabB = await browser_tab_open({ url: 'https://page-b.com', activate: false });

    // Switch to tab B
    const result = await browser_tab_switch({ tabId: tabB.tabId });

    expect(result.success).toBe(true);
    expect(result.newTab.id).toBe(tabB.tabId);
    expect(result.newTab.url).toBe('https://page-b.com');
  });

  it('returns previousTab when switching', async () => {
    // Create tabs
    const tabA = await browser_tab_open({ url: 'https://first.com', activate: true });
    const tabB = await browser_tab_open({ url: 'https://second.com', activate: true });

    // Switch back to tab A
    const result = await browser_tab_switch({ tabId: tabA.tabId });

    expect(result.previousTab).toBe(tabB.tabId);
    expect(result.newTab.id).toBe(tabA.tabId);
  });

  it('throws TabNotFound for non-existent tab', async () => {
    await expect(
      browser_tab_switch({ tabId: 'non-existent-tab-12345' })
    ).rejects.toThrow();
  });

  it('newTab includes url and title', async () => {
    const tab = await browser_tab_open({ url: 'https://info-test.com', activate: true });

    // Switch to same tab (to test the return structure)
    const result = await browser_tab_switch({ tabId: tab.tabId });

    expect(result.newTab.url).toBeDefined();
    expect(result.newTab.title).toBeDefined();
    expect(typeof result.newTab.url).toBe('string');
    expect(typeof result.newTab.title).toBe('string');
  });
});
