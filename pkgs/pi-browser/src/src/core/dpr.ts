import type { CDPClient } from "./cdp-client.js";

const dprCache = new Map<string, number>();

// Sync cache lookup - returns undefined if not cached
export function getCachedDPR(targetId: string): number | undefined {
  return dprCache.get(targetId);
}

// Async helper - checks cache first, then detects if needed
export async function getOrDetectDPR(
  targetId: string,
  cdp: CDPClient,
): Promise<number> {
  const cached = dprCache.get(targetId);
  if (cached) return cached;
  return detectDPR(cdp, targetId);
}

export function setCachedDPR(targetId: string, dpr: number): void {
  dprCache.set(targetId, dpr);
}

export function invalidateDPR(targetId: string): void {
  dprCache.delete(targetId);
}

export function cssToScreenshot(
  cssX: number,
  cssY: number,
  dpr: number,
): { x: number; y: number } {
  return {
    x: Math.round(cssX * dpr),
    y: Math.round(cssY * dpr),
  };
}

export function screenshotToCss(
  imgX: number,
  imgY: number,
  dpr: number,
): { x: number; y: number } {
  return {
    x: Math.round(imgX / dpr),
    y: Math.round(imgY / dpr),
  };
}

// Detection only - performs CDP calls and caches result
export async function detectDPR(
  cdp: CDPClient,
  targetId: string,
): Promise<number> {
  // Try 1: Emulation.getDeviceMetricsOverride (most reliable)
  try {
    const result = (await cdp.send("Emulation.getDeviceMetricsOverride", {})) as {
      deviceScaleFactor?: number;
    };
    if (result.deviceScaleFactor && result.deviceScaleFactor > 0) {
      dprCache.set(targetId, result.deviceScaleFactor);
      return result.deviceScaleFactor;
    }
  } catch {
    // Continue to next method
  }

  // Try 2: Runtime.evaluate for window.devicePixelRatio
  try {
    const result = (await cdp.send("Runtime.evaluate", {
      expression: "window.devicePixelRatio",
      returnByValue: true,
    })) as {
      result?: { value?: number };
    };
    if (result.result?.value && result.result.value > 0) {
      dprCache.set(targetId, result.result.value);
      return result.result.value;
    }
  } catch {
    // Continue to fallback
  }

  // Try 3: Page.getLayoutMetrics
  try {
    const result = (await cdp.send("Page.getLayoutMetrics", {})) as {
      visualViewport?: {
        clientWidth?: number;
        clientHeight?: number;
        scale?: number;
      };
      cssVisualViewport?: {
        clientWidth?: number;
        clientHeight?: number;
      };
    };
    if (
      result.visualViewport?.clientWidth &&
      result.cssVisualViewport?.clientWidth
    ) {
      const calculatedDpr =
        result.visualViewport.clientWidth / result.cssVisualViewport.clientWidth;
      if (calculatedDpr > 0) {
        dprCache.set(targetId, calculatedDpr);
        return calculatedDpr;
      }
    }
    if (result.visualViewport?.scale) {
      dprCache.set(targetId, result.visualViewport.scale);
      return result.visualViewport.scale;
    }
  } catch {
    // Fall through to default
  }

  // Fallback: assume DPR 1
  dprCache.set(targetId, 1);
  return 1;
}
