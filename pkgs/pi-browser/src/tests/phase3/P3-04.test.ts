import { describe, it, expect, afterEach, vi } from 'vitest';
import { browser_wait } from '../../src/core/tools-wait.js';
import { closePersistentConnection } from '../../src/core/cdp-client.js';

describe('P3-04: wait:element polls until selector found', () => {
  const targetId = 'wait-element-test';
  let eventHandlers: Map<string, (params: unknown) => void>;
  let mockClient: {
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

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

    return { mockClient, eventHandlers };
  }

  it('returns success=true when element is found immediately', async () => {
    await setupMockClient();

    // Mock DOM.querySelector to return a node immediately
    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'DOM.enable') return {};
      if (method === 'DOM.querySelector') return { nodeId: 123 };
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'element',
      selector: '#test-element',
      timeout: 5000,
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe(123); // nodeId returned
  });

  it('returns waitedMs in result', async () => {
    await setupMockClient();

    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'DOM.enable') return {};
      if (method === 'DOM.querySelector') return { nodeId: 1 };
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'element',
      selector: '.found',
      timeout: 1000,
    });

    expect(result.waitedMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.waitedMs).toBe('number');
  });

  it('polls multiple times until element appears', async () => {
    await setupMockClient();

    let callCount = 0;
    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'DOM.enable') return {};
      if (method === 'DOM.querySelector') {
        callCount++;
        // Element appears on 3rd call
        if (callCount >= 3) {
          return { nodeId: 456 };
        }
        return { nodeId: 0 };
      }
      return {};
    });

    const startTime = Date.now();
    const result = await browser_wait({
      target: targetId,
      type: 'element',
      selector: '#appears-later',
      timeout: 5000,
    });
    const elapsed = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(3);
    expect(elapsed).toBeGreaterThanOrEqual(100); // Should have taken some time
  });

  it('returns success=false on timeout when element not found', async () => {
    await setupMockClient();

    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'DOM.enable') return {};
      if (method === 'DOM.querySelector') return { nodeId: 0 }; // Never found
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'element',
      selector: '#never-exists',
      timeout: 300, // Short timeout for test
    });

    expect(result.success).toBe(false);
    expect(result.waitedMs).toBeGreaterThanOrEqual(300);
  });

  it('requires selector parameter for element wait type', async () => {
    await setupMockClient();

    const result = await browser_wait({
      target: targetId,
      type: 'element',
      // No selector provided
      timeout: 100,
    });

    expect(result.success).toBe(false);
  });
});
