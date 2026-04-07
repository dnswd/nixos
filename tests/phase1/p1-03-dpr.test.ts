import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  getCachedDPR,
  invalidateDPR,
  cssToScreenshot,
  screenshotToCss,
} from '../../pkgs/pi-web-browse/src/core/dpr.js';
import {
  registerCDPClient,
  unregisterCDPClient,
} from '../../pkgs/pi-web-browse/src/core/tools-page.js';

describe('P1-03: DPR Management', () => {
  describe('cssToScreenshot', () => {
    it('converts CSS coordinates to screenshot coordinates with DPR 1', () => {
      const result = cssToScreenshot(100, 200, 1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('converts CSS coordinates to screenshot coordinates with DPR 2', () => {
      const result = cssToScreenshot(100, 200, 2);
      expect(result).toEqual({ x: 200, y: 400 });
    });

    it('rounds fractional coordinates correctly', () => {
      const result = cssToScreenshot(100.5, 200.7, 2);
      expect(result).toEqual({ x: 201, y: 401 });
    });

    it('handles DPR 3 (Retina displays)', () => {
      const result = cssToScreenshot(100, 100, 3);
      expect(result).toEqual({ x: 300, y: 300 });
    });
  });

  describe('screenshotToCss', () => {
    it('converts screenshot coordinates to CSS coordinates with DPR 1', () => {
      const result = screenshotToCss(100, 200, 1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('converts screenshot coordinates to CSS coordinates with DPR 2', () => {
      const result = screenshotToCss(200, 400, 2);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('rounds fractional coordinates correctly', () => {
      const result = screenshotToCss(401, 801, 2);
      expect(result).toEqual({ x: 201, y: 401 });
    });

    it('handles DPR 1.5 (fractional DPR)', () => {
      const result = screenshotToCss(150, 300, 1.5);
      expect(result).toEqual({ x: 100, y: 200 });
    });
  });

  describe('DPR Caching', () => {
    const TARGET_ID = 'dpr-test-tab';
    const TARGET_ID_2 = 'dpr-test-tab-2';

    afterAll(() => {
      unregisterCDPClient(TARGET_ID);
      unregisterCDPClient(TARGET_ID_2);
    });

    it('caches DPR per tab', async () => {
      // Create two mock clients with different DPR values
      const dpr1Client = {
        async send(method: string) {
          if (method === 'Emulation.getDeviceMetricsOverride') {
            return { result: { deviceScaleFactor: 2 } };
          }
          return { result: {} };
        },
      };

      const dpr2Client = {
        async send(method: string) {
          if (method === 'Emulation.getDeviceMetricsOverride') {
            return { result: { deviceScaleFactor: 3 } };
          }
          return { result: {} };
        },
      };

      registerCDPClient(TARGET_ID, dpr1Client);
      registerCDPClient(TARGET_ID_2, dpr2Client);

      // First call should query and cache
      const dpr1First = await getCachedDPR(TARGET_ID, dpr1Client);
      expect(dpr1First).toBe(2);

      const dpr2First = await getCachedDPR(TARGET_ID_2, dpr2Client);
      expect(dpr2First).toBe(3);

      // Create spies to verify no additional CDP calls for cached values
      const sendSpy1 = vi.spyOn(dpr1Client, 'send');
      const sendSpy2 = vi.spyOn(dpr2Client, 'send');

      // Second call should use cached value
      const dpr1Second = await getCachedDPR(TARGET_ID, dpr1Client);
      const dpr2Second = await getCachedDPR(TARGET_ID_2, dpr2Client);

      expect(dpr1Second).toBe(2);
      expect(dpr2Second).toBe(3);

      // Should not have called send again
      expect(sendSpy1).not.toHaveBeenCalled();
      expect(sendSpy2).not.toHaveBeenCalled();
    });

    it('invalidateDPR clears cache for navigation', async () => {
      // Create client
      let dprValue = 2;
      const mockClient = {
        async send(method: string) {
          if (method === 'Emulation.getDeviceMetricsOverride') {
            return { result: { deviceScaleFactor: dprValue } };
          }
          return { result: {} };
        },
      };

      registerCDPClient('invalidate-test', mockClient);

      // Initial query
      const dprBefore = await getCachedDPR('invalidate-test', mockClient);
      expect(dprBefore).toBe(2);

      // Invalidate (simulating navigation)
      invalidateDPR('invalidate-test');

      // Change the DPR value that would be returned
      dprValue = 1.5;

      // Next call should re-query
      const dprAfter = await getCachedDPR('invalidate-test', mockClient);
      expect(dprAfter).toBe(1.5);

      unregisterCDPClient('invalidate-test');
    });
  });

  describe('DPR Query Fallback Chain', () => {
    it('uses Emulation.getDeviceMetricsOverride when available', async () => {
      const mockClient = {
        async send(method: string) {
          if (method === 'Emulation.getDeviceMetricsOverride') {
            return { result: { deviceScaleFactor: 2.5 } };
          }
          return { result: {} };
        },
      };

      registerCDPClient('fallback-1', mockClient);
      const dpr = await getCachedDPR('fallback-1', mockClient);
      expect(dpr).toBe(2.5);
      unregisterCDPClient('fallback-1');
    });

    it('falls back to window.devicePixelRatio when Emulation fails', async () => {
      const mockClient = {
        async send(method: string, params?: Record<string, unknown>) {
          if (method === 'Emulation.getDeviceMetricsOverride') {
            // Simulate CDP error (emulation not available)
            throw new Error('Emulation domain not available');
          }
          if (method === 'Runtime.evaluate') {
            const expression = String(params?.expression ?? '');
            if (expression === 'window.devicePixelRatio') {
              return { result: { value: 1.75, type: 'number' } };
            }
          }
          return { result: {} };
        },
      };

      registerCDPClient('fallback-2', mockClient);
      const dpr = await getCachedDPR('fallback-2', mockClient);
      expect(dpr).toBe(1.75);
      unregisterCDPClient('fallback-2');
    });

    it('returns 1 when both methods fail', async () => {
      const mockClient = {
        async send() {
          // Both methods fail
          throw new Error('All methods failed');
        },
      };

      registerCDPClient('fallback-3', mockClient);
      const dpr = await getCachedDPR('fallback-3', mockClient);
      expect(dpr).toBe(1);
      unregisterCDPClient('fallback-3');
    });

    it('returns 1 when deviceScaleFactor is 0 or negative', async () => {
      const mockClient = {
        async send(method: string) {
          if (method === 'Emulation.getDeviceMetricsOverride') {
            return { result: { deviceScaleFactor: 0 } };
          }
          return { result: {} };
        },
      };

      registerCDPClient('fallback-4', mockClient);
      const dpr = await getCachedDPR('fallback-4', mockClient);
      expect(dpr).toBe(1);
      unregisterCDPClient('fallback-4');
    });

    it('handles Runtime.evaluate returning undefined value', async () => {
      const mockClient = {
        async send(method: string) {
          if (method === 'Emulation.getDeviceMetricsOverride') {
            return { result: { deviceScaleFactor: undefined } };
          }
          if (method === 'Runtime.evaluate') {
            return { result: { value: undefined, type: 'undefined' } };
          }
          return { result: {} };
        },
      };

      registerCDPClient('fallback-5', mockClient);
      const dpr = await getCachedDPR('fallback-5', mockClient);
      expect(dpr).toBe(1);
      unregisterCDPClient('fallback-5');
    });
  });
});
