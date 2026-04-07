import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MockCDPServer } from "../mocks/mock-cdp.js";
import { browser_network, getNetworkBufferSize, isCapturing, clearNetworkBuffer } from "../../src/core/tools-network.js";

describe("P2-01: browser_network enable/disable capture", () => {
  let mockServer: MockCDPServer;
  let targetId: string;
  const MOCK_PORT = 19223;

  beforeAll(async () => {
    mockServer = new MockCDPServer(MOCK_PORT);
    await mockServer.start();

    // Create a mock tab
    targetId = mockServer.addTab({
      url: "https://example.com",
      title: "Test Page",
    });

    process.env.CDP_WS_URL = `ws://localhost:${MOCK_PORT}/devtools/browser`;
  });

  afterAll(async () => {
    await mockServer.stop();
    delete process.env.CDP_WS_URL;
  });

  beforeEach(() => {
    // Clear buffer before each test
    clearNetworkBuffer(targetId);
  });

  it("should enable network capture and return capturing state", async () => {
    const result = await browser_network({ target: targetId, enable: true });

    expect(result.capturing).toBe(true);
    expect(result.requestsCount).toBe(0);
    expect(isCapturing(targetId)).toBe(true);
  });

  it("should disable network capture and return request count", async () => {
    // First enable
    await browser_network({ target: targetId, enable: true });

    // Then disable
    const result = await browser_network({ target: targetId, enable: false });

    expect(result.capturing).toBe(false);
    expect(result.requestsCount).toBe(0); // Buffer empty, but that's fine
    expect(isCapturing(targetId)).toBe(false);
  });

  it("should clear buffer on fresh enable", async () => {
    // Enable capture
    await browser_network({ target: targetId, enable: true });

    // Disable to retain buffer (simulating some requests)
    await browser_network({ target: targetId, enable: false });

    // Re-enable - buffer should be cleared
    const result = await browser_network({ target: targetId, enable: true });

    expect(result.capturing).toBe(true);
    expect(result.requestsCount).toBe(0);
    expect(getNetworkBufferSize(targetId)).toBe(0);
  });

  it("should support filter with urlPattern", async () => {
    const result = await browser_network({
      target: targetId,
      enable: true,
      filter: { urlPattern: "*.api.example.com/*" },
    });

    expect(result.capturing).toBe(true);
    expect(result.requestsCount).toBe(0);
  });

  it("should support filter with resourceTypes", async () => {
    const result = await browser_network({
      target: targetId,
      enable: true,
      filter: { resourceTypes: ["XHR", "Fetch"] },
    });

    expect(result.capturing).toBe(true);
    expect(result.requestsCount).toBe(0);
  });

  it("should support filter with both urlPattern and resourceTypes", async () => {
    const result = await browser_network({
      target: targetId,
      enable: true,
      filter: {
        urlPattern: "*.api.example.com/*",
        resourceTypes: ["XHR", "Fetch"],
      },
    });

    expect(result.capturing).toBe(true);
    expect(result.requestsCount).toBe(0);
  });

  it("should handle toggle sequence correctly", async () => {
    // Enable
    const start = await browser_network({ target: targetId, enable: true });
    expect(start.capturing).toBe(true);

    // Disable
    const stop = await browser_network({ target: targetId, enable: false });
    expect(stop.capturing).toBe(false);

    // Re-enable
    const restart = await browser_network({ target: targetId, enable: true });
    expect(restart.capturing).toBe(true);
    expect(restart.requestsCount).toBe(0);
  });
});
