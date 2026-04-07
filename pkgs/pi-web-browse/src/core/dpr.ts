import type { CDPClient } from './tools-page.js';

// DPR cache per tab (targetId)
const dprCache = new Map<string, number>();

/**
 * Get cached DPR for a target, querying from CDP if not cached.
 */
export async function getCachedDPR(targetId: string, cdp: CDPClient): Promise<number> {
  if (!dprCache.has(targetId)) {
    const dpr = await queryDPR(cdp);
    dprCache.set(targetId, dpr);
  }
  return dprCache.get(targetId)!;
}

/**
 * Invalidate DPR cache for a target (call on navigation).
 */
export function invalidateDPR(targetId: string): void {
  dprCache.delete(targetId);
}

/**
 * Convert CSS coordinates to screenshot coordinates.
 */
export function cssToScreenshot(cssX: number, cssY: number, dpr: number): { x: number; y: number } {
  return { x: Math.round(cssX * dpr), y: Math.round(cssY * dpr) };
}

/**
 * Convert screenshot coordinates to CSS coordinates.
 */
export function screenshotToCss(imgX: number, imgY: number, dpr: number): { x: number; y: number } {
  return { x: Math.round(imgX / dpr), y: Math.round(imgY / dpr) };
}

/**
 * Query DPR from CDP. Tries Emulation.getDeviceMetricsOverride first,
 * then falls back to Runtime.evaluate window.devicePixelRatio.
 */
async function queryDPR(cdp: CDPClient): Promise<number> {
  // Try 1: Emulation.getDeviceMetricsOverride
  try {
    const { result } = await cdp.send('Emulation.getDeviceMetricsOverride'); {
      const deviceScaleFactor = (result as { deviceScaleFactor?: number })?.deviceScaleFactor;
      if (typeof deviceScaleFactor === 'number' && deviceScaleFactor > 0) {
        return deviceScaleFactor;
      }
    }
  } catch {}

  // Try 2: Runtime.evaluate window.devicePixelRatio
  try {
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: 'window.devicePixelRatio',
      returnByValue: true,
    });
    const value = result?.value;
    if (typeof value === 'number' && value > 0) {
      return value;
    }
  } catch {}

  // Fallback
  return 1;
}
