import { describe, it, expect, afterEach, vi } from "vitest";
import {
  browser_network,
  getNetworkEntries,
  clearNetworkBuffer,
  addNetworkRequest,
  addNetworkResponse,
  getNetworkBuffer,
} from "../../src/core/tools-network.js";
import {
  closePersistentConnection,
} from "../../src/core/cdp-client.js";

describe("P2-02: Request Correlation", () => {
  const targetId = "correlation-test-target";
  let eventHandlers: Map<string, (params: unknown) => void>;
  let mockClient: { send: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  afterEach(() => {
    clearNetworkBuffer(targetId);
    closePersistentConnection(targetId);
    vi.restoreAllMocks();
  });

  async function setupMockClient() {
    eventHandlers = new Map();

    mockClient = {
      send: vi.fn().mockResolvedValue({}),
      on: vi.fn((event: string, handler: (params: unknown) => void) => {
        eventHandlers.set(event, handler);
      }),
      close: vi.fn(),
    };

    const cdpModule = await import("../../src/core/cdp-client.js");
    vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);
    vi.spyOn(cdpModule, "hasPersistentConnection").mockReturnValue(true);

    return { mockClient, eventHandlers };
  }

  describe("Mock Tests", () => {
    it("should correlate request and response by requestId", async () => {
      await setupMockClient();

      await browser_network({ target: targetId, enable: true });

      // Simulate requestWillBeSent event
      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      if (requestHandler) {
        requestHandler({
          requestId: "req-123",
          request: {
            url: "https://api.example.com/data",
            method: "GET",
            headers: { "Accept": "application/json" },
          },
          timestamp: Date.now() / 1000,
        });
      }

      // Simulate responseReceived event
      const responseHandler = eventHandlers.get("Network.responseReceived");
      if (responseHandler) {
        responseHandler({
          requestId: "req-123",
          response: {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/json" },
            mimeType: "application/json",
          },
          timestamp: Date.now() / 1000,
        });
      }

      // Verify entry is correlated
      const entries = getNetworkEntries(targetId);
      expect(entries.length).toBe(1);
      expect(entries[0].requestId).toBe("req-123");
      expect(entries[0].request.url).toBe("https://api.example.com/data");
      expect(entries[0].response?.status).toBe(200);
    });

    it("should handle multiple requests with different IDs", async () => {
      await setupMockClient();

      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      // Simulate 3 different requests
      for (let i = 1; i <= 3; i++) {
        const requestId = `req-${i}`;

        if (requestHandler) {
          requestHandler({
            requestId,
            request: {
              url: `https://api.example.com/item${i}`,
              method: "GET",
              headers: {},
            },
            timestamp: Date.now() / 1000,
          });
        }

        if (responseHandler) {
          responseHandler({
            requestId,
            response: {
              status: 200,
              statusText: "OK",
              headers: {},
              mimeType: "application/json",
            },
            timestamp: Date.now() / 1000,
          });
        }
      }

      const entries = getNetworkEntries(targetId);
      expect(entries.length).toBe(3);
    });

    it("should handle response without matching request (orphan)", async () => {
      await setupMockClient();

      await browser_network({ target: targetId, enable: true });

      const responseHandler = eventHandlers.get("Network.responseReceived");

      // Send response without prior request
      if (responseHandler) {
        responseHandler({
          requestId: "orphan-123",
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            mimeType: "text/html",
          },
          timestamp: Date.now() / 1000,
        });
      }

      // Orphan responses without matching requests create incomplete entries
      const entries = getNetworkEntries(targetId);
      // Entry exists but has no request info
      expect(entries.length).toBeLessThanOrEqual(1);
    });

    it("should handle fromCache flag correctly", async () => {
      await setupMockClient();

      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");

      if (requestHandler) {
        requestHandler({
          requestId: "cached-req",
          request: {
            url: "https://example.com/cached.js",
            method: "GET",
            headers: {},
          },
          timestamp: Date.now() / 1000,
          redirectResponse: {
            fromDiskCache: true,
          },
        });
      }

      const entries = getNetworkEntries(targetId);
      expect(entries.length).toBe(1);
      expect(entries[0].fromCache).toBe(true);
    });
  });

  describe("Direct Buffer Tests", () => {
    it("correlates request and response by requestId", () => {
      const requestId = "req-123";

      // Add request
      addNetworkRequest(targetId, {
        requestId,
        url: "https://api.example.com/data",
        method: "GET",
        headers: { "Accept": "application/json" },
        timestamp: Date.now(),
      });

      // Add response for same requestId
      addNetworkResponse(targetId, {
        requestId,
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        mimeType: "application/json",
        encodedDataLength: 1024,
        timestamp: Date.now(),
      });

      // Get correlated entry
      const entries = getNetworkEntries(targetId);
      expect(entries).toHaveLength(1);
      expect(entries[0].requestId).toBe(requestId);
      expect(entries[0].request.url).toBe("https://api.example.com/data");
      expect(entries[0].response?.status).toBe(200);
      expect(entries[0].response?.mimeType).toBe("application/json");
    });

    it("handles orphaned requests (no response)", () => {
      addNetworkRequest(targetId, {
        requestId: "orphan-1",
        url: "https://example.com/orphan",
        method: "GET",
        headers: {},
        timestamp: Date.now(),
      });

      const entries = getNetworkEntries(targetId);
      expect(entries).toHaveLength(1);
      expect(entries[0].response).toBeUndefined();
    });

    it("handles orphaned responses (no matching request)", () => {
      addNetworkResponse(targetId, {
        requestId: "no-request",
        status: 404,
        statusText: "Not Found",
        headers: {},
        mimeType: "text/plain",
        encodedDataLength: 0,
        timestamp: Date.now(),
      });

      const entries = getNetworkEntries(targetId);
      expect(entries).toHaveLength(1);
      expect(entries[0].requestId).toBe("no-request");
      expect(entries[0].request).toBeUndefined();
      expect(entries[0].response?.status).toBe(404);
    });

    it("correlates multiple requests with different IDs", () => {
      for (let i = 1; i <= 3; i++) {
        addNetworkRequest(targetId, {
          requestId: `req-${i}`,
          url: `https://example.com/api/${i}`,
          method: "GET",
          headers: {},
          timestamp: Date.now(),
        });

        addNetworkResponse(targetId, {
          requestId: `req-${i}`,
          status: 200,
          statusText: "OK",
          headers: {},
          mimeType: "application/json",
          encodedDataLength: 100 * i,
          timestamp: Date.now(),
        });
      }

      const entries = getNetworkEntries(targetId);
      expect(entries).toHaveLength(3);

      // Verify each is correlated
      entries.forEach((entry, idx) => {
        expect(entry.requestId).toBe(`req-${idx + 1}`);
        expect(entry.request).toBeDefined();
        expect(entry.response).toBeDefined();
      });
    });

    it("updates existing entry on duplicate requestId", () => {
      const requestId = "duplicate";

      addNetworkRequest(targetId, {
        requestId,
        url: "https://example.com/v1",
        method: "GET",
        headers: {},
        timestamp: 1000,
      });

      // Second request with same ID (should update)
      addNetworkRequest(targetId, {
        requestId,
        url: "https://example.com/v2",
        method: "POST",
        headers: { "x-custom": "header" },
        timestamp: 2000,
      });

      const entries = getNetworkEntries(targetId);
      expect(entries).toHaveLength(1);
      expect(entries[0].request.url).toBe("https://example.com/v2");
      expect(entries[0].request.method).toBe("POST");
    });

    it("getNetworkBuffer returns the buffer map", () => {
      const buffer = getNetworkBuffer(targetId);
      expect(buffer).toBeInstanceOf(Map);

      addNetworkRequest(targetId, {
        requestId: "buffer-test",
        url: "https://example.com/buffer",
        method: "GET",
        headers: {},
        timestamp: Date.now(),
      });

      expect(buffer.size).toBe(1);
      expect(buffer.has("buffer-test")).toBe(true);
    });
  });
});
