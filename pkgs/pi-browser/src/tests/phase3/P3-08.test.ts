import { describe, it, expect, afterEach, vi } from 'vitest';
import { browser_emulate } from '../../src/extras/tools-emulation.js';
import { closePersistentConnection } from '../../src/core/cdp-client.js';

describe('P3-08: emulate applies device preset, screenshot dimensions match', () => {
  const targetId = 'emulate-test-target';
  let mockClient: {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let sentCommands: Array<{ method: string; params: Record<string, unknown> }>;

  afterEach(() => {
    closePersistentConnection(targetId);
    vi.restoreAllMocks();
  });

  async function setupMockClient() {
    sentCommands = [];

    mockClient = {
      send: vi.fn().mockImplementation(async (method: string, params?: Record<string, unknown>) => {
        sentCommands.push({ method, params: params || {} });
        return {};
      }),
      close: vi.fn(),
    };

    const cdpModule = await import('../../src/core/cdp-client.js');
    vi.spyOn(cdpModule, 'getCDPClient').mockResolvedValue(mockClient as any);

    return { mockClient, sentCommands };
  }

  it('applies iPhone 14 Pro preset correctly', async () => {
    await setupMockClient();

    const result = await browser_emulate({
      target: targetId,
      device: 'iPhone14Pro',
    });

    expect(result.success).toBe(true);
    expect(result.applied.width).toBe(393);
    expect(result.applied.height).toBe(852);
    expect(result.applied.dpr).toBe(3);
    expect(result.applied.mobile).toBe(true);
    expect(result.applied.touch).toBe(true);
    expect(result.applied.userAgent).toContain('iPhone');

    // Verify CDP commands sent
    const setMetricsCall = sentCommands.find(
      (c) => c.method === 'Emulation.setDeviceMetricsOverride'
    );
    expect(setMetricsCall).toBeDefined();
    expect(setMetricsCall?.params.width).toBe(393);
    expect(setMetricsCall?.params.height).toBe(852);
    expect(setMetricsCall?.params.mobile).toBe(true);
  });

  it('applies Pixel 7 preset correctly', async () => {
    await setupMockClient();

    const result = await browser_emulate({
      target: targetId,
      device: 'Pixel7',
    });

    expect(result.success).toBe(true);
    expect(result.applied.width).toBe(412);
    expect(result.applied.height).toBe(915);
    expect(result.applied.dpr).toBe(2.625);
    expect(result.applied.mobile).toBe(true);
    expect(result.applied.userAgent).toContain('Pixel 7');
  });

  it('allows manual override of preset values', async () => {
    await setupMockClient();

    const result = await browser_emulate({
      target: targetId,
      device: 'iPhone14Pro',
      width: 500, // Override preset
      mobile: false, // Override preset
    });

    expect(result.success).toBe(true);
    expect(result.applied.width).toBe(500); // Manual value wins
    expect(result.applied.mobile).toBe(false); // Manual value wins
    expect(result.applied.height).toBe(852); // Preset value kept
  });

  it('applies manual values without preset', async () => {
    await setupMockClient();

    const result = await browser_emulate({
      target: targetId,
      width: 1280,
      height: 720,
      dpr: 2,
      mobile: false,
      touch: false,
    });

    expect(result.success).toBe(true);
    expect(result.applied.width).toBe(1280);
    expect(result.applied.height).toBe(720);
    expect(result.applied.dpr).toBe(2);
    expect(result.applied.mobile).toBe(false);
    expect(result.applied.touch).toBe(false);
  });

  it('clears emulation when clear=true', async () => {
    await setupMockClient();

    const result = await browser_emulate({
      target: targetId,
      clear: true,
    });

    expect(result.success).toBe(true);
    expect(result.cleared).toBe(true);
    expect(result.applied.width).toBe(1280);
    expect(result.applied.height).toBe(720);
    expect(result.applied.dpr).toBe(1);

    const setMetricsCall = sentCommands.find(
      (c) => c.method === 'Emulation.setDeviceMetricsOverride'
    );
    expect(setMetricsCall?.params.width).toBe(0);
  });

  it('enables touch emulation for mobile devices', async () => {
    await setupMockClient();

    await browser_emulate({
      target: targetId,
      device: 'iPad',
    });

    const touchCall = sentCommands.find(
      (c) => c.method === 'Emulation.setTouchEmulationEnabled'
    );
    expect(touchCall).toBeDefined();
    expect(touchCall?.params.enabled).toBe(true);
  });

  it('sets user agent override when provided', async () => {
    await setupMockClient();

    await browser_emulate({
      target: targetId,
      device: 'Desktop',
      userAgent: 'CustomAgent/1.0',
    });

    const uaCall = sentCommands.find(
      (c) => c.method === 'Emulation.setUserAgentOverride'
    );
    expect(uaCall).toBeDefined();
    expect(uaCall?.params.userAgent).toBe('CustomAgent/1.0');
  });

  it('does not set user agent when not provided', async () => {
    await setupMockClient();

    await browser_emulate({
      target: targetId,
      width: 1000,
      height: 800,
    });

    const uaCall = sentCommands.find(
      (c) => c.method === 'Emulation.setUserAgentOverride'
    );
    // Should not call setUserAgentOverride when no UA provided
    expect(uaCall).toBeUndefined();
  });
});
