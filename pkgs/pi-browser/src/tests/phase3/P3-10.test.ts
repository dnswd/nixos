import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const CACHE_DIR = path.join(homedir(), '.cache', 'pi-browser');
const SOCKETS_DIR = path.join(CACHE_DIR, 'sockets');
const TEST_PORT = 9337;

// Mocks must be defined at top level (hoisted by vitest)
vi.mock('../../src/core/daemon.js', () => ({
  startDaemon: vi.fn(async (tabId: string) => {
    if (process.platform !== 'win32') {
      const socketPath = path.join(SOCKETS_DIR, `${tabId}.sock`);
      if (!fs.existsSync(SOCKETS_DIR)) {
        fs.mkdirSync(SOCKETS_DIR, { recursive: true });
      }
      fs.writeFileSync(socketPath, '');
    }
  }),
  stopDaemon: vi.fn(async (tabId: string) => {
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

vi.mock('../../src/core/mutex.js', () => ({
  acquireMutex: vi.fn().mockResolvedValue(undefined),
  releaseMutex: vi.fn().mockResolvedValue(undefined),
  isMutexHeld: vi.fn().mockReturnValue(false),
}));

// Static import for MockCDPServer (doesn't use daemon/mutex)
import { MockCDPServer } from '../mocks/mock-cdp.js';

describe('P3-10: E2E multi-tab workflow', () => {
  let mockServer: MockCDPServer;
  let originalEnv: string | undefined;
  
  // Store dynamically imported functions
  let browser_tab_open: any;
  let browser_tab_switch: any;
  let browser_tab_close: any;

  beforeAll(async () => {
    // CRITICAL: Clear module cache so vi.mock() applies fresh
    // Other tests use vi.restoreAllMocks() which clears module mocks
    vi.resetModules();
    
    // Dynamically import tools-tab AFTER clearing cache to get mocked version
    const toolsTab = await import('../../src/core/tools-tab.js');
    browser_tab_open = toolsTab.browser_tab_open;
    browser_tab_switch = toolsTab.browser_tab_switch;
    browser_tab_close = toolsTab.browser_tab_close;

    originalEnv = process.env.CDP_WS_URL;
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();
    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;

    if (!fs.existsSync(SOCKETS_DIR)) {
      fs.mkdirSync(SOCKETS_DIR, { recursive: true });
    }
  });

  afterAll(async () => {
    if (originalEnv) {
      process.env.CDP_WS_URL = originalEnv;
    } else {
      delete process.env.CDP_WS_URL;
    }
    await mockServer.stop();
  });

  it('full workflow: open A → open B → switch A → close A → B active', async () => {
    // Step 1: Open tab A
    const tabA = await browser_tab_open({
      url: 'https://page-a.com',
      activate: true,
    });
    expect(tabA.tabId).toBeDefined();
    expect(tabA.active).toBe(true);
    expect(tabA.url).toBe('https://page-a.com');

    // Step 2: Open tab B
    const tabB = await browser_tab_open({
      url: 'https://page-b.com',
      activate: true, // This should make B active
    });
    expect(tabB.tabId).toBeDefined();
    expect(tabB.tabId).not.toBe(tabA.tabId);
    expect(tabB.active).toBe(true);
    expect(tabB.url).toBe('https://page-b.com');

    // Verify both socket files exist (Unix)
    if (process.platform !== 'win32') {
      expect(fs.existsSync(tabA.daemonSocket)).toBe(true);
      expect(fs.existsSync(tabB.daemonSocket)).toBe(true);
    }

    // Step 3: Switch back to tab A
    const switchResult = await browser_tab_switch({ tabId: tabA.tabId });
    expect(switchResult.success).toBe(true);
    expect(switchResult.newTab.id).toBe(tabA.tabId);
    expect(switchResult.previousTab).toBe(tabB.tabId);

    // Step 4: Close tab A
    const closeResult = await browser_tab_close({
      tabId: tabA.tabId,
      allowQuit: false, // Not last tab, so ok
    });
    expect(closeResult.closed).toBe(true);
    expect(closeResult.newActiveTab).toBeDefined();

    // Verify tab A socket is removed (Unix)
    if (process.platform !== 'win32') {
      expect(fs.existsSync(tabA.daemonSocket)).toBe(false);
    }

    // Step 5: Verify tab B is now active (or some tab is active)
    expect(closeResult.newActiveTab).toBe(tabB.tabId);

    // Clean up tab B
    await browser_tab_close({
      tabId: tabB.tabId,
      allowQuit: true,
    });

    // Verify tab B socket is also removed (Unix)
    if (process.platform !== 'win32') {
      expect(fs.existsSync(tabB.daemonSocket)).toBe(false);
    }
  });

  it('can open multiple tabs and manage them independently', async () => {
    const tabs = [];

    // Open 3 tabs
    for (let i = 1; i <= 3; i++) {
      const tab = await browser_tab_open({
        url: `https://multi-${i}.com`,
        activate: i === 1, // Only first is active
      });
      tabs.push(tab);
    }

    // Verify all have unique IDs
    const tabIds = tabs.map((t) => t.tabId);
    expect(new Set(tabIds).size).toBe(3); // All unique

    // Switch between tabs
    for (const tab of tabs) {
      const result = await browser_tab_switch({ tabId: tab.tabId });
      expect(result.success).toBe(true);
      expect(result.newTab.id).toBe(tab.tabId);
    }

    // Close all tabs
    for (const tab of tabs) {
      const result = await browser_tab_close({
        tabId: tab.tabId,
        allowQuit: tab.tabId === tabs[tabs.length - 1].tabId, // Allow quit on last
      });
      expect(result.closed).toBe(true);
    }

    // Verify all sockets removed (Unix)
    if (process.platform !== 'win32') {
      for (const tab of tabs) {
        expect(fs.existsSync(tab.daemonSocket)).toBe(false);
      }
    }
  });

  it('active tab switching updates correctly', async () => {
    // Open two tabs
    const tab1 = await browser_tab_open({
      url: 'https://first.com',
      activate: true,
    });

    const tab2 = await browser_tab_open({
      url: 'https://second.com',
      activate: false, // Don't activate
    });

    // Tab1 should still be active (we didn't activate tab2)
    // Now switch to tab2
    const switch1 = await browser_tab_switch({ tabId: tab2.tabId });
    expect(switch1.previousTab).toBe(tab1.tabId);
    expect(switch1.newTab.id).toBe(tab2.tabId);

    // Switch back to tab1
    const switch2 = await browser_tab_switch({ tabId: tab1.tabId });
    expect(switch2.previousTab).toBe(tab2.tabId);
    expect(switch2.newTab.id).toBe(tab1.tabId);

    // Clean up
    await browser_tab_close({ tabId: tab1.tabId, allowQuit: false });
    await browser_tab_close({ tabId: tab2.tabId, allowQuit: true });
  });
});
