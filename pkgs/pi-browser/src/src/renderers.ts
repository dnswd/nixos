import type { ScreenshotResult } from "./core/tools-page.js";
import type { ExportResult } from "./core/tools-network.js";

export interface RenderedImage {
  type: "image";
  source: string;
  caption: string;
}

export interface RenderedJSON {
  type: "json";
  source: string;
  caption: string;
  collapsible: boolean;
}

export function screenshotRenderer(result: ScreenshotResult): RenderedImage {
  return {
    type: "image",
    source: `file://${result.path}`,
    caption:
      `Screenshot: ${result.cssWidth}x${result.cssHeight} CSS pixels ` +
      `(Image: ${result.width}x${result.height}, DPR: ${result.dpr})\n` +
      `Coordinate mapping: Screenshot pixels ÷ ${result.dpr} = CSS pixels`,
  };
}

export function harRenderer(result: ExportResult): RenderedJSON {
  const sizeMB = (result.size / 1024 / 1024).toFixed(2);
  const totalMB = (result.summary.totalSize / 1024 / 1024).toFixed(2);

  return {
    type: "json",
    source: `file://${result.path}`,
    caption: `HAR Export: ${result.entryCount} entries (${sizeMB} MB)\n` +
             `Summary: ${result.summary.totalRequests} requests, ` +
             `${result.summary.failedRequests} failed, ` +
             `${totalMB} MB total data, ` +
             `${(result.summary.totalTime / 1000).toFixed(2)}s total time`,
    collapsible: true,
  };
}
