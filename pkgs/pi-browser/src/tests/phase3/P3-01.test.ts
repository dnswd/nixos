import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { browser_tab_open } from '../../src/core/tools-tab.js';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import * as mutexModule from '../../src/core/mutex.js';

const CACHE_DIR = path.join(homedir(), '.cache', 'pi-browser');
const SOCKETS_DIR = path.join(CACHE_DIR, 'sockets');
const MUTEX_DIR = path.join(CACHE_DIR, 'mutex');

describe('P3-01: tab_open creates new tab and daemon', () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 9333;
  let originalEnv: string | undefined;
  let daemonStarted = false;

  beforeEach(async () => {
    // Mock mutex to prevent file-based locking hangs
    vi.spyOn(mutexModule, 'acquireMutex').mockResolvedValue(undefined);
    vi.spyOn(mutexModule, 'releaseMutex').mockResolvedValue(undefined);
    
    daemonStarted = false;
    originalEnv = process.env.CDP_WS_URL;
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();
    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;

    // Ensure sockets directory exists
    if (!fs.existsSync(SOCKETS_DIR)) {
      fs.mkdirSync(SOCKETS_DIR, { recursive: true });
    }

    // Mock daemon functions to avoid actual process spawning
    const daemonModule = await import('../../src/core/daemon.js');
    vi.spyOn(daemonModule, 'startDaemon').mockImplementation(async (tabId: string) => {
      daemonStarted = true;
      // Create mock socket file (Unix)
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

  it('creates new tab with Target.createTarget', async () => {
    const result = await browser_tab_open({ url: 'https://example.com' });

    expect(result.tabId).toBeDefined();
    expect(result.tabId.length).toBeGreaterThan(0);
    expect(result.url).toBe('https://example.com');
    expect(result.active).toBe(true);
  });

  it('daemon is started for new tab', async () => {
    await browser_tab_open({ url: 'https://test-daemon.com' });
    expect(daemonStarted).toBe(true);
  });

  it('returns daemon socket path', async () => {
    const result = await browser_tab_open({ url: 'https://test.com' });

    expect(result.daemonSocket).toBeDefined();
    if (process.platform === 'win32') {
      expect(result.daemonSocket).toContain('\\.\\pipe\\');
      expect(result.daemonSocket).toContain('pi-browser-');
    } else {
      expect(result.daemonSocket).toContain('.sock');
      expect(result.daemonSocket).toContain(result.tabId);
    }
  });

  it('socket file exists after open (Unix)', async () => {
    if (process.platform === 'win32') {
      return; // Skip on Windows - named pipes don't create files
    }

    const result = await browser_tab_open({ url: 'https://socket-test.com' });

    // Socket file should exist after daemon mock creates it
    expect(fs.existsSync(result.daemonSocket)).toBe(true);
  });

  it('respects activate=false parameter', async () => {
    const result = await browser_tab_open({
      url: 'https://inactive.com',
      activate: false,
    });

    expect(result.active).toBe(false);
    expect(result.tabId).toBeDefined();
  });

  it('returns windowId if provided', async () => {
    const result = await browser_tab_open({
      url: 'https://window-test.com',
      windowId: '123',
    });

    expect(result.windowId).toBe('123');
  });
});
