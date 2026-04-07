import { describe, it, expect, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import {
  browser_network,
  browser_network_export,
  ExportResult,
  clearNetworkBuffer,
} from "../../src/core/tools-network.js";
import {
  closePersistentConnection,
} from "../../src/core/cdp-client.js";

describe("P2-04: HAR Timing", () => {
  const targetId = "timing-test-target";
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
      send: vi.fn().mockResolvedValue({}),
      on: vi.fn((event: string, handler: (params: unknown) => void) => {
        eventHandlers.set(event, handler);
      }),
      close: vi.fn(),
    };

    const cdpModule = await import("../../src/core/cdp-client.js");
    vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

    return { mockClient, eventHandlers };
  }

  describe("Mock Tests", () => {
    it("includes DNS timing in HAR entries", async () => {
      await setupMockClient();
      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      // Timing values from CDP are in seconds, dnsStart=10, dnsEnd=50 = 40ms
      if (requestHandler) {
        requestHandler({
          requestId: "req-dns",
          request: { url: "https://api.example.com/data", method: "GET", headers: {} },
          timestamp: 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "req-dns",
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            mimeType: "application/json",
            timing: {
              requestTime: 1000,
              dnsStart: 10,
              dnsEnd: 50,  // 40ms DNS
              connectStart: 50,
              connectEnd: 100,
              sslStart: 60,
              sslEnd: 100,
              sendStart: 100,
              sendEnd: 105,
              receiveHeadersEnd: 200,
            },
          },
          timestamp: 1000,
        });
      }

      const result: ExportResult = await browser_network_export({ target: targetId });
      exportPath = result.path;

      const har = JSON.parse(await fs.readFile(result.path, "utf8"));
      expect(har.log.entries).toHaveLength(1);
      const entry = har.log.entries[0];
      // DNS timing: (dnsEnd - dnsStart) * 1000 = (50 - 10) * 1000 = 40000ms
      expect(entry.timings.dns).toBe(40000);
    });

    it("includes SSL timing in HAR entries", async () => {
      await setupMockClient();
      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      // SSL: sslStart=20, sslEnd=80 = 60ms
      if (requestHandler) {
        requestHandler({
          requestId: "req-ssl",
          request: { url: "https://secure.example.com/", method: "GET", headers: {} },
          timestamp: 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "req-ssl",
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            mimeType: "text/html",
            timing: {
              requestTime: 1000,
              dnsStart: -1,  // No DNS (cached)
              dnsEnd: -1,
              connectStart: 0,
              connectEnd: 100,
              sslStart: 20,
              sslEnd: 80,  // 60ms SSL handshake
              sendStart: 100,
              sendEnd: 110,
              receiveHeadersEnd: 300,
            },
          },
          timestamp: 1000,
        });
      }

      const result: ExportResult = await browser_network_export({ target: targetId });
      exportPath = result.path;

      const har = JSON.parse(await fs.readFile(result.path, "utf8"));
      const entry = har.log.entries[0];
      // SSL timing: (sslEnd - sslStart) * 1000 = (80 - 20) * 1000 = 60000ms
      expect(entry.timings.ssl).toBe(60000);
    });

    it("includes send, wait, receive timing", async () => {
      await setupMockClient();
      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");
      const finishedHandler = eventHandlers.get("Network.loadingFinished");

      if (requestHandler) {
        requestHandler({
          requestId: "req-full",
          request: { url: "https://example.com/api", method: "GET", headers: {} },
          timestamp: 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "req-full",
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            mimeType: "application/json",
            timing: {
              requestTime: 1000,
              dnsStart: 0,
              dnsEnd: 20,      // 20ms DNS
              connectStart: 20,
              connectEnd: 60,  // 40ms connect
              sslStart: 30,
              sslEnd: 60,      // 30ms SSL
              sendStart: 60,
              sendEnd: 65,    // 5ms send
              receiveHeadersEnd: 165,  // 100ms wait (TTFB)
            },
          },
          timestamp: 2000,  // 1 second after request
        });
      }

      if (finishedHandler) {
        finishedHandler({
          requestId: "req-full",
          timestamp: 2000,
          encodedDataLength: 1024,
        });
      }

      const result: ExportResult = await browser_network_export({ target: targetId });
      exportPath = result.path;

      const har = JSON.parse(await fs.readFile(result.path, "utf8"));
      const entry = har.log.entries[0];
      // Send: (sendEnd - sendStart) * 1000 = (65 - 60) * 1000 = 5000ms
      expect(entry.timings.send).toBe(5000);
      // Wait: (receiveHeadersEnd - sendEnd) * 1000 = (165 - 65) * 1000 = 100000ms
      expect(entry.timings.wait).toBe(100000);
    });

    it("handles -1 values for unused timings", async () => {
      await setupMockClient();
      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      // HTTP request (no SSL)
      if (requestHandler) {
        requestHandler({
          requestId: "req-http",
          request: { url: "http://example.com/", method: "GET", headers: {} },
          timestamp: 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "req-http",
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            mimeType: "text/html",
            timing: {
              requestTime: 1000,
              dnsStart: 1,    // DNS used
              dnsEnd: 11,     // 10ms DNS
              connectStart: 11,
              connectEnd: 31,
              // sslStart/sslEnd omitted = no SSL (HTTP)
              sendStart: 31,
              sendEnd: 36,
              receiveHeadersEnd: 136,
            },
          },
          timestamp: 1000,
        });
      }

      const result: ExportResult = await browser_network_export({ target: targetId });
      exportPath = result.path;

      const har = JSON.parse(await fs.readFile(result.path, "utf8"));
      const entry = har.log.entries[0];
      // No SSL for HTTP requests - omitted fields result in -1
      expect(entry.timings.ssl).toBe(-1);
      // DNS was used
      expect(entry.timings.dns).toBe(10000);
    });

    it("calculates total time correctly", async () => {
      await setupMockClient();
      await browser_network({ target: targetId, enable: true });

      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      if (requestHandler) {
        requestHandler({
          requestId: "req-total",
          request: { url: "https://example.com/slow", method: "GET", headers: {} },
          timestamp: 1000,
        });
      }

      if (responseHandler) {
        responseHandler({
          requestId: "req-total",
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            mimeType: "text/html",
            timing: {
              requestTime: 1000,
              dnsStart: 10,    // 10s start
              dnsEnd: 60,      // 50ms DNS (60-10)*1000=50000
              connectStart: 60,
              connectEnd: 160,  // 100ms (160-60)*1000=100000
              sslStart: 80,
              sslEnd: 140,     // 60ms (140-80)*1000=60000
              sendStart: 160,
              sendEnd: 170,    // 10ms (170-160)*1000=10000
              receiveHeadersEnd: 370,  // 200ms wait (370-170)*1000=200000
            },
          },
          timestamp: 1000,
        });
      }

      const result: ExportResult = await browser_network_export({ target: targetId });
      exportPath = result.path;

      const har = JSON.parse(await fs.readFile(result.path, "utf8"));
      const entry = har.log.entries[0];

      // Verify all individual timings
      expect(entry.timings.dns).toBe(50000);      // (60 - 10) * 1000
      expect(entry.timings.connect).toBe(100000);  // (160 - 60) * 1000
      expect(entry.timings.ssl).toBe(60000);      // (140 - 80) * 1000
      expect(entry.timings.send).toBe(10000);     // (170 - 160) * 1000
      expect(entry.timings.wait).toBe(200000);    // (370 - 170) * 1000

      // Total = DNS + Connect + SSL + Send + Wait (all in ms)
      const expectedTotal = 50000 + 100000 + 60000 + 10000 + 200000;
      expect(entry.time).toBe(expectedTotal);
      expect(entry.time).toBe(entry.timings.dns +
                               entry.timings.connect +
                               entry.timings.ssl +
                               entry.timings.send +
                               entry.timings.wait);
    });
  });
});
