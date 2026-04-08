import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { browser_wait } from '../../src/core/tools-wait.js';
import { closePersistentConnection } from '../../src/core/cdp-client.js';
import * as mutexModule from '../../src/core/mutex.js';

describe('P3-05: wait:network detects idle after requests finish', () => {
  const targetId = 'wait-network-test';
  let eventHandlers: Map<string, (params: unknown) => void>;
  let mockClient: {
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock mutex to prevent file-based locking hangs
    vi.spyOn(mutexModule, 'acquireMutex').mockResolvedValue(undefined);
    vi.spyOn(mutexModule, 'releaseMutex').mockResolvedValue(undefined);
  });

  afterEach(() => {
    closePersistentConnection(targetId);
    vi.restoreAllMocks();
  });

  async function setupMockClient() {
    eventHandlers = new Map();

    mockClient = {
      send: vi.fn().mockResolvedValue({}),
      on: vi.fn((event: string, handler: (params: unknown) => void) => {
        eventHandlers.set(event, handler);
      }),
      off: vi.fn(),
      close: vi.fn(),
    };

    const cdpModule = await import('../../src/core/cdp-client.js');
    vi.spyOn(cdpModule, 'getCDPClient').mockResolvedValue(mockClient as any);
    vi.spyOn(cdpModule, 'hasPersistentConnection').mockReturnValue(true);

    return { mockClient, eventHandlers };
  }

  it('returns success=true when network is already idle', async () => {
    await setupMockClient();

    mockClient.send.mockResolvedValue({});

    // No events fired - network is already idle
    const result = await browser_wait({
      target: targetId,
      type: 'network',
      timeout: 1000,
    });

    // Should succeed after 500ms quiet period
    expect(result.success).toBe(true);
  });

  it('waits for 500ms quiet period after last request', async () => {
    await setupMockClient();

    mockClient.send.mockResolvedValue({});

    const startTime = Date.now();

    const resultPromise = browser_wait({
      target: targetId,
      type: 'network',
      timeout: 3000,
    });

    // Wait for event handlers to be registered (Network.enable and on() calls)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate request start
    const requestHandler = eventHandlers.get('Network.requestWillBeSent');
    if (requestHandler) {
      requestHandler({ requestId: 'req-1' });
    }

    // Simulate request end after 200ms
    setTimeout(() => {
      const finishedHandler = eventHandlers.get('Network.loadingFinished');
      if (finishedHandler) {
        finishedHandler({ requestId: 'req-1' });
      }
    }, 200);

    const result = await resultPromise;
    const elapsed = Date.now() - startTime;

    expect(result.success).toBe(true);
    // Should wait at least 200ms (request) + 500ms (quiet period) + 50ms setup
    expect(elapsed).toBeGreaterThanOrEqual(600);
  });

  it('returns success=false if requests never finish', async () => {
    await setupMockClient();

    mockClient.send.mockResolvedValue({});

    const resultPromise = browser_wait({
      target: targetId,
      type: 'network',
      timeout: 400, // Short timeout
    });

    // Start a request but never finish it
    const requestHandler = eventHandlers.get('Network.requestWillBeSent');
    if (requestHandler) {
      requestHandler({ requestId: 'hanging-req' });
    }

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.waitedMs).toBeGreaterThanOrEqual(400);
  });

  it('handles multiple concurrent requests', async () => {
    await setupMockClient();

    mockClient.send.mockResolvedValue({});

    const resultPromise = browser_wait({
      target: targetId,
      type: 'network',
      timeout: 2000,
    });

    const requestHandler = eventHandlers.get('Network.requestWillBeSent');
    const finishedHandler = eventHandlers.get('Network.loadingFinished');

    // Start 3 requests
    if (requestHandler) {
      requestHandler({ requestId: 'req-1' });
      requestHandler({ requestId: 'req-2' });
      requestHandler({ requestId: 'req-3' });
    }

    // Finish them staggered
    setTimeout(() => {
      if (finishedHandler) finishedHandler({ requestId: 'req-1' });
    }, 100);
    setTimeout(() => {
      if (finishedHandler) finishedHandler({ requestId: 'req-2' });
    }, 200);
    setTimeout(() => {
      if (finishedHandler) finishedHandler({ requestId: 'req-3' });
    }, 300);

    const result = await resultPromise;

    expect(result.success).toBe(true);
  });

  it('handles loadingFailed events as finished', async () => {
    await setupMockClient();

    mockClient.send.mockResolvedValue({});

    const resultPromise = browser_wait({
      target: targetId,
      type: 'network',
      timeout: 1000,
    });

    const requestHandler = eventHandlers.get('Network.requestWillBeSent');
    const failedHandler = eventHandlers.get('Network.loadingFailed');

    if (requestHandler) {
      requestHandler({ requestId: 'fail-req' });
    }

    setTimeout(() => {
      if (failedHandler) failedHandler({ requestId: 'fail-req' });
    }, 100);

    const result = await resultPromise;

    expect(result.success).toBe(true);
  });
});
