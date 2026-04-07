import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MockCDPServer } from "../mocks/mock-cdp.js";
import { browser_shot } from "../../config/devel/pi-mono/extensions/pi-browser/src/core/tools-page.js";
import { getCachedDPR } from "../../config/devel/pi-mono/extensions/pi-browser/src/core/dpr.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("P1-01: browser_shot DPR detection", () => {
  let mockServer: MockCDPServer;
  let targetId: string;
  const MOCK_PORT = 19222;

  beforeAll(async () => {
    mockServer = new MockCDPServer(MOCK_PORT);
    await mockServer.start();

    // Create a mock tab
    targetId = mockServer.addTab({
      url: "https://example.com",
      title: "Test Page",
    });

    // Set up page content
    mockServer.setPageContent(
      targetId,
      "<html><body><h1>Test</h1></body></html>",
    );

    // Set DPR for Retina simulation
    mockServer.setDevicePixelRatio(targetId, 2);

    process.env.CDP_WS_URL = `ws://localhost:${MOCK_PORT}/devtools/browser`;
  });

  afterAll(async () => {
    await mockServer.stop();
    delete process.env.CDP_WS_URL;

    // Clean up any screenshot files
    const cacheDir = path.join(os.homedir(), ".cache/pi-browser/screenshots");
    try {
      const files = fs.readdirSync(cacheDir);
      for (const file of files) {
        if (file.endsWith(".png")) {
          fs.unlinkSync(path.join(cacheDir, file));
        }
      }
    } catch {
      // Directory may not exist
    }
  });

  it("should capture screenshot with correct DPR detection", async () => {
    const result = await browser_shot({ target: targetId });

    // Verify screenshot was saved
    expect(result.path).toBeTruthy();
    expect(fs.existsSync(result.path)).toBe(true);

    // Verify dimensions
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    // Verify DPR was detected (mock is set to 2 for Retina)
    expect(result.dpr).toBe(2);

    // Verify CSS dimensions are calculated correctly
    expect(result.cssWidth).toBe(Math.round(result.width / result.dpr));
    expect(result.cssHeight).toBe(Math.round(result.height / result.dpr));

    // Verify DPR was cached
    const cachedDpr = getCachedDPR(targetId);
    expect(cachedDpr).toBe(result.dpr);

    // Verify file is a valid PNG
    const buffer = fs.readFileSync(result.path);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buffer.slice(0, 8)).toEqual(pngSignature);
  });

  it("should return consistent DPR for same target", async () => {
    const result1 = await browser_shot({ target: targetId });
    const result2 = await browser_shot({ target: targetId });

    // DPR should be consistent across multiple calls (both should be 2)
    expect(result1.dpr).toBe(2);
    expect(result2.dpr).toBe(2);
    expect(result1.dpr).toBe(result2.dpr);

    // CSS dimensions should be consistent
    expect(result1.cssWidth).toBe(result2.cssWidth);
    expect(result1.cssHeight).toBe(result2.cssHeight);
  });

  it("should save screenshot with correct metadata", async () => {
    const result = await browser_shot({ target: targetId });

    // Verify path structure
    expect(result.path).toContain(".cache/pi-browser/screenshots");
    expect(result.path).toContain(targetId.replace(/[^a-zA-Z0-9-_]/g, "_"));
    expect(result.path.endsWith(".png")).toBe(true);
  });
});
