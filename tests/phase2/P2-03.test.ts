import { describe, it, expect, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import {
  browser_network,
  browser_network_export,
  ExportResult,
  clearNetworkBuffer,
} from "../../config/devel/pi-mono/extensions/pi-browser/src/core/tools-network.js";
import {
  closePersistentConnection,
} from "../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js";

describe("P2-03: HAR Structure", () => {
  const targetId = "har-test-target";
  let eventHandlers: Map<string, (params: unknown) => void>;
  let mockClient: { send: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let exportPath: string | undefined;

  afterEach(async () => {
    if (exportPath) {
      try {
        await fs.unlink(exportPath);
      } catch {
        // Ignore
      }
      exportPath = undefined;
    }
    clearNetworkBuffer(targetId);
    closePersistentConnection(targetId);
    vi.restoreAllMocks();
  });

  async function setupMockClient() {
    eventHandlers = new Map();

    mockClient = {
      send: vi.fn().mockImplementation((method: string) => {
        if (method === "Network.getResponseBody") {
          return Promise.resolve({
            body: '{"data": "test"}',
            base64Encoded: false,
          });
        }
        if (method === "Runtime.evaluate") {
          return Promise.resolve({ result: { value: "Test Page" } });
        }
        return Promise.resolve({});
      }),
      on: vi.fn((event: string, handler: (params: unknown) => void) => {
        eventHandlers.set(event, handler);
      }),
      close: vi.fn(),
    };

    const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
    vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

    return { mockClient, eventHandlers };
  }

  describe("Mock Tests", () => {
    it("should export valid HAR v1.2 structure", async () => {
      await setupMockClient();

      await browser_network({ target: targetId, enable: true });

      // Simulate network request
      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      if (requestHandler) {
        requestHandler({
          requestId: "har-req-1",
          request: {
            url: "https://api.example.com/data",
            method: "GET",
            headers: { "Accept": "application/json" },
          },
          timestamp: Date.now() / 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "har-req-1",
          response: {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/json" },
            mimeType: "application/json",
            encodedDataLength: 1024,
          },
          timestamp: Date.now() / 1000,
        });
      }

      const result: ExportResult = await browser_network_export({
        target: targetId,
      });
      exportPath = result.path;

      const har = JSON.parse(await fs.readFile(result.path, "utf8"));

      // Validate HAR structure
      expect(har.log).toBeDefined();
      expect(har.log.version).toBe("1.2");
      expect(har.log.creator).toBeDefined();
      expect(har.log.creator.name).toBe("pi-browser");
      expect(har.log.creator.version).toBeDefined();
      expect(har.log.entries).toBeInstanceOf(Array);
    });

    it("should include all required HAR fields", async () => {
      await setupMockClient();

      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      if (requestHandler) {
        requestHandler({
          requestId: "har-req-2",
          request: {
            url: "https://api.example.com/full",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            postData: '{"key":"value"}',
          },
          timestamp: Date.now() / 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "har-req-2",
          response: {
            status: 201,
            statusText: "Created",
            headers: { "Content-Type": "application/json" },
            mimeType: "application/json",
            encodedDataLength: 2048,
          },
          timestamp: Date.now() / 1000,
        });
      }

      const result: ExportResult = await browser_network_export({
        target: targetId,
        includeContent: true,
      });
      exportPath = result.path;

      const har = JSON.parse(await fs.readFile(result.path, "utf8"));
      const entry = har.log.entries[0];

      // Check required fields
      expect(entry.startedDateTime).toBeDefined();
      expect(entry.time).toBeGreaterThanOrEqual(0);
      expect(entry.request).toBeDefined();
      expect(entry.request.method).toBe("POST");
      expect(entry.request.url).toBe("https://api.example.com/full");
      expect(entry.request.headers).toBeInstanceOf(Array);
      expect(entry.response).toBeDefined();
      expect(entry.response.status).toBe(201);
      expect(entry.cache).toBeDefined();
      expect(entry.timings).toBeDefined();
    });

    it("should export empty HAR when no requests captured", async () => {
      await setupMockClient();

      await browser_network({ target: targetId, enable: true });
      // Don't simulate any requests

      const result: ExportResult = await browser_network_export({
        target: targetId,
      });
      exportPath = result.path;

      const har = JSON.parse(await fs.readFile(result.path, "utf8"));

      expect(har.log.version).toBe("1.2");
      expect(har.log.entries).toEqual([]);
      expect(result.entryCount).toBe(0);
    });

    it("should generate correct summary statistics", async () => {
      await setupMockClient();

      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      // Simulate successful request
      if (requestHandler) {
        requestHandler({
          requestId: "success-1",
          request: { url: "https://example.com/ok", method: "GET", headers: {} },
          timestamp: Date.now() / 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "success-1",
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            mimeType: "text/html",
            encodedDataLength: 1000,
          },
          timestamp: Date.now() / 1000,
        });
      }

      // Simulate failed request
      if (requestHandler) {
        requestHandler({
          requestId: "fail-1",
          request: { url: "https://example.com/error", method: "GET", headers: {} },
          timestamp: Date.now() / 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "fail-1",
          response: {
            status: 500,
            statusText: "Server Error",
            headers: {},
            mimeType: "text/plain",
            encodedDataLength: 50,
          },
          timestamp: Date.now() / 1000,
        });
      }

      const result: ExportResult = await browser_network_export({
        target: targetId,
      });
      exportPath = result.path;

      expect(result.summary.totalRequests).toBe(2);
      expect(result.summary.failedRequests).toBe(1);
      expect(result.summary.totalSize).toBe(1050); // 1000 + 50
    });
  });
});
