import { getCDPClient } from '../core/cdp-client.js';

// Device preset configuration
interface DevicePreset {
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
  touch: boolean;
  userAgent: string | null;
}

// Device presets for common devices (15+ presets)
const PRESETS: Record<string, DevicePreset> = {
  iPhone14Pro: {
    width: 393,
    height: 852,
    dpr: 3,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
  },
  iPhone14ProMax: {
    width: 430,
    height: 932,
    dpr: 3,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
  },
  iPhone13: {
    width: 390,
    height: 844,
    dpr: 3,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
  },
  Pixel7: {
    width: 412,
    height: 915,
    dpr: 2.625,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
  },
  Pixel7Pro: {
    width: 412,
    height: 892,
    dpr: 3.5,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
  },
  SamsungS23: {
    width: 384,
    height: 854,
    dpr: 3,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
  },
  iPad: {
    width: 810,
    height: 1080,
    dpr: 2,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
  },
  iPadPro: {
    width: 1024,
    height: 1366,
    dpr: 2,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
  },
  iPadMini: {
    width: 768,
    height: 1024,
    dpr: 2,
    mobile: true,
    touch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
  },
  Desktop: {
    width: 1280,
    height: 720,
    dpr: 1,
    mobile: false,
    touch: false,
    userAgent: null
  },
  DesktopHD: {
    width: 1920,
    height: 1080,
    dpr: 1,
    mobile: false,
    touch: false,
    userAgent: null
  },
  Desktop4K: {
    width: 3840,
    height: 2160,
    dpr: 1,
    mobile: false,
    touch: false,
    userAgent: null
  },
  MacBookAir: {
    width: 1440,
    height: 900,
    dpr: 2,
    mobile: false,
    touch: false,
    userAgent: null
  },
  MacBookPro14: {
    width: 1512,
    height: 982,
    dpr: 2,
    mobile: false,
    touch: false,
    userAgent: null
  },
  MacBookPro16: {
    width: 1728,
    height: 1117,
    dpr: 2,
    mobile: false,
    touch: false,
    userAgent: null
  }
};

// Result type for browser_emulate
export interface EmulateResult {
  success: boolean;
  applied: {
    width: number;
    height: number;
    dpr: number;
    mobile: boolean;
    touch: boolean;
    userAgent?: string;
  };
  cleared?: boolean;
}

/**
 * Emulate a device in the browser by setting viewport metrics, user agent, and touch support.
 * 
 * @param params - Emulation parameters
 * @returns Result with applied emulation settings
 */
export async function browser_emulate({
  target,
  device,
  width,
  height,
  dpr,
  mobile,
  touch,
  userAgent,
  clear = false
}: {
  target?: string;
  device?: 'iPhone14Pro' | 'iPhone14ProMax' | 'iPhone13' | 'Pixel7' | 'Pixel7Pro' | 
           'SamsungS23' | 'iPad' | 'iPadPro' | 'iPadMini' | 'Desktop' | 'DesktopHD' | 
           'Desktop4K' | 'MacBookAir' | 'MacBookPro14' | 'MacBookPro16' | string;
  width?: number;
  height?: number;
  dpr?: number;
  mobile?: boolean;
  touch?: boolean;
  userAgent?: string;
  clear?: boolean;
}): Promise<EmulateResult> {
  const targetId = target || 'default';
  const cdp = await getCDPClient(targetId);

  try {
    // If clear is true, reset all emulation to defaults
    if (clear) {
      // Clear device metrics override
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 0,
        height: 0,
        deviceScaleFactor: 0,
        mobile: false
      });

      // Clear user agent override
      await cdp.send('Emulation.setUserAgentOverride', {
        userAgent: ''
      });

      // Disable touch emulation
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: false
      });

      return {
        success: true,
        cleared: true,
        applied: {
          width: 1280,
          height: 720,
          dpr: 1,
          mobile: false,
          touch: false
        }
      };
    }

    // Get preset values if device is specified
    let preset: DevicePreset | null = null;
    if (device && PRESETS[device]) {
      preset = PRESETS[device];
    }

    // Build final values: preset base with manual overrides
    const finalWidth = width ?? preset?.width ?? 1280;
    const finalHeight = height ?? preset?.height ?? 720;
    const finalDpr = dpr ?? preset?.dpr ?? 1;
    const finalMobile = mobile ?? preset?.mobile ?? false;
    const finalTouch = touch ?? preset?.touch ?? false;
    const finalUserAgent = userAgent ?? preset?.userAgent ?? null;

    // Apply device metrics override
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: finalWidth,
      height: finalHeight,
      deviceScaleFactor: finalDpr,
      mobile: finalMobile
    });

    // Apply user agent override if provided
    if (finalUserAgent) {
      await cdp.send('Emulation.setUserAgentOverride', {
        userAgent: finalUserAgent
      });
    }

    // Apply touch emulation
    await cdp.send('Emulation.setTouchEmulationEnabled', {
      enabled: finalTouch
    });

    const result: EmulateResult = {
      success: true,
      applied: {
        width: finalWidth,
        height: finalHeight,
        dpr: finalDpr,
        mobile: finalMobile,
        touch: finalTouch
      }
    };

    // Include userAgent in result if it was applied
    if (finalUserAgent) {
      result.applied.userAgent = finalUserAgent;
    }

    return result;

  } finally {
    cdp.close();
  }
}

/**
 * Get list of available device presets.
 * @returns Array of preset names
 */
export function getDevicePresets(): string[] {
  return Object.keys(PRESETS);
}

/**
 * Get details of a specific device preset.
 * @param name - Preset name
 * @returns Device preset configuration or null if not found
 */
export function getDevicePreset(name: string): DevicePreset | null {
  return PRESETS[name] || null;
}
