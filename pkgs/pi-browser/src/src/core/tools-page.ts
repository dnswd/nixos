import { getCDPClient } from "./cdp-client.js";
import { detectDPR, setCachedDPR } from "./dpr.js";
import { BrowserError } from "./errors.js";
import { PNG } from "pngjs";
import { promises as fs } from "fs";
import { homedir } from "os";
import * as path from "path";

export interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
  dpr: number;
  cssWidth: number;
  cssHeight: number;
}

export interface HTMLResult {
  html: string;
  length: number;
  truncated: boolean;
}

export async function browser_shot({
  target,
}: {
  target: string;
}): Promise<ScreenshotResult> {
  const cdp = await getCDPClient(target);

  try {
    // Capture screenshot
    const { data } = (await cdp.send("Page.captureScreenshot", {
      format: "png",
    })) as { data: string };

    // Get DPR
    const dpr = await detectDPR(cdp, target);
    setCachedDPR(target, dpr);

    // Save to cache directory
    const cacheDir = path.join(homedir(), ".cache/pi-browser/screenshots");
    await fs.mkdir(cacheDir, { recursive: true });

    const timestamp = Date.now();
    // Sanitize target ID for filename
    const safeTarget = target.replace(/[^a-zA-Z0-9-_]/g, "_");
    const filepath = path.join(cacheDir, `${timestamp}-${safeTarget}.png`);

    const imageBuffer = Buffer.from(data, "base64");
    await fs.writeFile(filepath, imageBuffer);

    // Get image dimensions using pngjs
    const png = PNG.sync.read(imageBuffer);
    const width = png.width;
    const height = png.height;

    // Calculate CSS dimensions (viewport size in logical pixels)
    const cssWidth = Math.round(width / dpr);
    const cssHeight = Math.round(height / dpr);

    return {
      path: filepath,
      width,
      height,
      dpr,
      cssWidth,
      cssHeight,
    };
  } finally {
    cdp.close();
  }
}

export async function browser_html({
  target,
  selector,
}: {
  target: string;
  selector?: string;
}): Promise<HTMLResult> {
  const cdp = await getCDPClient(target);

  try {
    const expression = selector
      ? `document.querySelector(${JSON.stringify(selector)})?.outerHTML`
      : "document.documentElement.outerHTML";

    const response = (await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    })) as {
      result?: { value?: string | null; type?: string };
      exceptionDetails?: { text: string; lineNumber?: number; columnNumber?: number };
    };

    // Check for JavaScript errors
    if (response.exceptionDetails) {
      throw new BrowserError(
        'JavaScriptError',
        `Line ${response.exceptionDetails.lineNumber || 0}: ${response.exceptionDetails.text}`,
        {
          line: response.exceptionDetails.lineNumber,
          column: response.exceptionDetails.columnNumber
        }
      );
    }

    let html = response.result?.value;

    // Check if element was not found (null or undefined)
    if (html === null || html === undefined) {
      throw new BrowserError('ElementNotFound', `Element not found: "${selector}"`);
    }

    html = html || "";

    // Handle truncation
    const MAX_LENGTH = 50000;
    let truncated = false;

    if (html.length > MAX_LENGTH) {
      html = html.substring(0, MAX_LENGTH) + "\n<!-- ... truncated ... -->";
      truncated = true;
    }

    return {
      html,
      length: html.length,
      truncated,
    };
  } finally {
    cdp.close();
  }
}
