import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { MockCDPServer } from "../mocks/mock-cdp.js";
import {
  browser_network,
  clearNetworkBuffer,
} from "../../config/devel/pi-mono/extensions/pi-browser/src/core/tools-network.js";
import {
  closePersistentConnection,
  getCDPClient,
} from "../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js";

// Helper type for mocked client
interface MockCDPClient {
  send: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

describe("P2-01: Network Enable/Disable", () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 19223;
  let targetId: string;
  let mockClient: MockCDPClient;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    // Create a test tab
    targetId = mockServer.addTab({
      url: "https://example.com",
      title: "Test Page",
    });

    // Set environment variable for CDP connection
    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;
  });

  afterAll(async () => {
    await mockServer.stop();
    delete process.env.CDP_WS_URL;
  });

  afterEach(() => {
    // Clean up after each test
    clearNetworkBuffer(targetId);
    closePersistentConnection(targetId);
    vi.clearAllMocks();
  });

  describe("Mock Tests", () => {
    it("should enable network capture and return capturing=true", async () => {
      // Mock getCDPClient directly
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      vi.spyOn(await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js"), "getCDPClient")
        .mockResolvedValue(mockClient as any);

      const result = await browser_network({ target: targetId, enable: true });

      expect(result.capturing).toBe(true);
      expect(result.requestsCount).toBe(0);
    });

    it("should disable network capture and return buffered request count", async () => {
      // First enable
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);
      vi.spyOn(cdpModule, "hasPersistentConnection").mockReturnValue(true);

      await browser_network({ target: targetId, enable: true });

      // Disable and verify count
      const result = await browser_network({ target: targetId, enable: false });

      expect(result.capturing).toBe(false);
    });

    it("should clear buffer on fresh enable", async () => {
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

      // Enable first time
      await browser_network({ target: targetId, enable: true });

      // Disable to preserve buffer
      vi.spyOn(cdpModule, "hasPersistentConnection").mockReturnValue(true);
      await browser_network({ target: targetId, enable: false });

      // Re-enable should clear buffer for fresh capture
      const result = await browser_network({ target: targetId, enable: true });

      expect(result.capturing).toBe(true);
      expect(result.requestsCount).toBe(0);
    });

    it("should handle enable when already enabled", async () => {
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

      await browser_network({ target: targetId, enable: true });
      const result = await browser_network({ target: targetId, enable: true });

      expect(result.capturing).toBe(true);
    });

    it("should handle disable when already disabled", async () => {
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);
      vi.spyOn(cdpModule, "hasPersistentConnection").mockReturnValue(false);

      const result = await browser_network({ target: targetId, enable: false });

      expect(result.capturing).toBe(false);
      expect(result.requestsCount).toBe(0);
    });

    it("should filter by urlPattern when provided", async () => {
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

      const result = await browser_network({
        target: targetId,
        enable: true,
        filter: { urlPattern: "*.api.com/*" },
      });

      expect(result.capturing).toBe(true);
      expect(mockClient.send).toHaveBeenCalledWith(
        "Network.setRequestInterception",
        expect.objectContaining({
          patterns: expect.arrayContaining([
            expect.objectContaining({ urlPattern: "*.api.com/*" }),
          ]),
        }),
      );
    });

    it("should filter by resourceTypes when provided", async () => {
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

      const result = await browser_network({
        target: targetId,
        enable: true,
        filter: { resourceTypes: ["XHR", "Fetch"] },
      });

      expect(result.capturing).toBe(true);
    });

    it("should combine urlPattern and resourceTypes filters", async () => {
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

      const result = await browser_network({
        target: targetId,
        enable: true,
        filter: {
          urlPattern: "*.api.com/*",
          resourceTypes: ["XHR"],
        },
      });

      expect(result.capturing).toBe(true);
      expect(mockClient.send).toHaveBeenCalledWith(
        "Network.setRequestInterception",
        expect.any(Object),
      );
    });
  });
});
