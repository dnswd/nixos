import { describe, it, expect, afterEach, vi } from 'vitest';
import { browser_wait } from '../../src/core/tools-wait.js';
import { closePersistentConnection } from '../../src/core/cdp-client.js';

describe('P3-06: wait:function polls expression until truthy', () => {
  const targetId = 'wait-function-test';
  let mockClient: {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  afterEach(() => {
    closePersistentConnection(targetId);
    vi.restoreAllMocks();
  });

  async function setupMockClient() {
    mockClient = {
      send: vi.fn().mockResolvedValue({}),
      close: vi.fn(),
    };

    const cdpModule = await import('../../src/core/cdp-client.js');
    vi.spyOn(cdpModule, 'getCDPClient').mockResolvedValue(mockClient as any);

    return { mockClient };
  }

  it('returns success=true when expression is immediately truthy', async () => {
    await setupMockClient();

    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'Runtime.enable') return {};
      if (method === 'Runtime.evaluate') {
        return { result: { value: true, type: 'boolean' } };
      }
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'function',
      expression: 'document.readyState === "complete"',
      timeout: 1000,
    });

    expect(result.success).toBe(true);
  });

  it('polls until expression becomes truthy', async () => {
    await setupMockClient();

    let callCount = 0;
    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'Runtime.enable') return {};
      if (method === 'Runtime.evaluate') {
        callCount++;
        // Return falsy first 2 times, then truthy
        if (callCount < 3) {
          return { result: { value: false, type: 'boolean' } };
        }
        return { result: { value: 'data loaded', type: 'string' } };
      }
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'function',
      expression: 'window.dataLoaded',
      timeout: 2000,
    });

    expect(result.success).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(3);
    expect(result.result).toBe('data loaded');
  });

  it('returns success=false on timeout if expression never truthy', async () => {
    await setupMockClient();

    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'Runtime.enable') return {};
      if (method === 'Runtime.evaluate') {
        return { result: { value: false, type: 'boolean' } };
      }
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'function',
      expression: 'window.neverTrue',
      timeout: 300,
    });

    expect(result.success).toBe(false);
    expect(result.waitedMs).toBeGreaterThanOrEqual(300);
  });

  it('treats empty string as falsy', async () => {
    await setupMockClient();

    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'Runtime.enable') return {};
      if (method === 'Runtime.evaluate') {
        return { result: { value: '', type: 'string' } };
      }
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'function',
      expression: 'document.querySelector("#missing")?.textContent',
      timeout: 200,
    });

    expect(result.success).toBe(false);
  });

  it('treats 0 as falsy', async () => {
    await setupMockClient();

    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'Runtime.enable') return {};
      if (method === 'Runtime.evaluate') {
        return { result: { value: 0, type: 'number' } };
      }
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'function',
      expression: 'document.querySelectorAll(".item").length',
      timeout: 200,
    });

    expect(result.success).toBe(false);
  });

  it('treats non-zero number as truthy', async () => {
    await setupMockClient();

    mockClient.send.mockImplementation(async (method: string) => {
      if (method === 'Runtime.enable') return {};
      if (method === 'Runtime.evaluate') {
        return { result: { value: 5, type: 'number' } };
      }
      return {};
    });

    const result = await browser_wait({
      target: targetId,
      type: 'function',
      expression: 'document.querySelectorAll(".item").length',
      timeout: 500,
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe(5);
  });

  it('requires expression parameter for function wait type', async () => {
    await setupMockClient();

    const result = await browser_wait({
      target: targetId,
      type: 'function',
      // No expression provided
      timeout: 100,
    });

    expect(result.success).toBe(false);
  });
});
