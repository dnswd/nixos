import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MockCDPServer } from "../mocks/mock-cdp.js";
import {
  browser_network,
  browser_network_export,
  clearNetworkBuffer,
  getNetworkEntries,
} from "../../src/core/tools-network.js";
import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";

describe("P2-03: browser_network_export HAR v1.2 format", () => {
  let mockServer: MockCDPServer;
  let targetId: string;
  const MOCK_PORT = 19224;

  beforeAll(async () => {
    mockServer = new MockCDPServer(MOCK_PORT);
    await mockServer.start();

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
    clearNetworkBuffer(targetId);
  });

  it("should export empty HAR when no network entries", async () => {
    const result = await browser_network_export({ target: targetId });

    expect(result.entryCount).toBe(0);
    expect(result.path).toContain(".har");
    expect(result.summary.totalRequests).toBe(0);
    expect(result.summary.failedRequests).toBe(0);

    // Verify file exists and is valid JSON
    const fileContent = await fs.readFile(result.path, "utf-8");
    const har = JSON.parse(fileContent);

    expect(har.log.version).toBe("1.2");
    expect(har.log.creator.name).toBe("pi-browser");
    expect(har.log.entries).toEqual([]);

    // Cleanup
    await fs.unlink(result.path);
  });

  it("should export HAR with valid v1.2 structure", async () => {
    // Enable network capture to populate buffer
    await browser_network({ target: targetId, enable: true });

    // Simulate network events via mock CDP
    const requestId = "req-1";
    mockServer.fireEvent(targetId, "Network.requestWillBeSent", {
      requestId,
      request: {
        url: "https://api.example.com/data",
        method: "GET",
        headers: { "Accept": "application/json" },
      },
      timestamp: Date.now() / 1000,
    });

    mockServer.fireEvent(targetId, "Network.responseReceived", {
      requestId,
      response: {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        mimeType: "application/json",
        encodedDataLength: 1234,
        timing: {
          requestTime: Date.now() / 1000,
          sendStart: 0,
          sendEnd: 0.01,
          receiveHeadersEnd: 0.05,
        },
      },
      timestamp: Date.now() / 1000,
    });

    // Small delay to let events process
    await new Promise((r) => setTimeout(r, 50));

    const result = await browser_network_export({ target: targetId });

    expect(result.entryCount).toBeGreaterThan(0);

    // Verify HAR structure
    const fileContent = await fs.readFile(result.path, "utf-8");
    const har = JSON.parse(fileContent);

    expect(har.log.version).toBe("1.2");
    expect(har.log.creator).toHaveProperty("name");
    expect(har.log.creator).toHaveProperty("version");
    expect(har.log.pages).toBeInstanceOf(Array);
    expect(har.log.entries).toBeInstanceOf(Array);
    expect(har.log.entries.length).toBeGreaterThan(0);

    const entry = har.log.entries[0];
    expect(entry).toHaveProperty("startedDateTime");
    expect(entry).toHaveProperty("time");
    expect(entry).toHaveProperty("request");
    expect(entry).toHaveProperty("response");
    expect(entry).toHaveProperty("timings");
    expect(entry).toHaveProperty("cache");

    // Verify request structure
    expect(entry.request).toHaveProperty("method");
    expect(entry.request).toHaveProperty("url");
    expect(entry.request).toHaveProperty("headers");
    expect(Array.isArray(entry.request.headers)).toBe(true);

    // Verify response structure
    expect(entry.response).toHaveProperty("status");
    expect(entry.response).toHaveProperty("statusText");
    expect(entry.response).toHaveProperty("headers");
    expect(entry.response).toHaveProperty("content");

    // Verify content structure
    expect(entry.response.content).toHaveProperty("size");
    expect(entry.response.content).toHaveProperty("mimeType");

    // Verify timings structure
    expect(entry.timings).toHaveProperty("dns");
    expect(entry.timings).toHaveProperty("connect");
    expect(entry.timings).toHaveProperty("ssl");
    expect(entry.timings).toHaveProperty("send");
    expect(entry.timings).toHaveProperty("wait");
    expect(entry.timings).toHaveProperty("receive");

    // Cleanup
    await fs.unlink(result.path);
  });

  it("should calculate correct summary statistics", async () => {
    // Enable network capture
    await browser_network({ target: targetId, enable: true });

    // Simulate multiple requests
    const requests = [
      { id: "req-1", status: 200, size: 1000 },
      { id: "req-2", status: 404, size: 200 },
      { id: "req-3", status: 500, size: 300 },
    ];

    for (const req of requests) {
      mockServer.fireEvent(targetId, "Network.requestWillBeSent", {
        requestId: req.id,
        request: {
          url: `https://api.example.com/${req.id}`,
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockServer.fireEvent(targetId, "Network.responseReceived", {
        requestId: req.id,
        response: {
          status: req.status,
          statusText: req.status === 200 ? "OK" : "Error",
          headers: {},
          mimeType: "application/json",
          encodedDataLength: req.size,
          timing: {
            requestTime: Date.now() / 1000,
            sendStart: 0,
            sendEnd: 0.01,
            receiveHeadersEnd: req.status === 200 ? 0.1 : 0.05,
          },
        },
        timestamp: Date.now() / 1000,
      });
    }

    await new Promise((r) => setTimeout(r, 50));

    const result = await browser_network_export({ target: targetId });

    expect(result.summary.totalRequests).toBe(3);
    expect(result.summary.failedRequests).toBe(2); // 404 and 500
    expect(result.summary.totalSize).toBe(1500); // 1000 + 200 + 300

    // Cleanup
    await fs.unlink(result.path);
  });

  it("should respect includeContent parameter", async () => {
    await browser_network({ target: targetId, enable: true });

    mockServer.fireEvent(targetId, "Network.requestWillBeSent", {
      requestId: "req-1",
      request: {
        url: "https://example.com",
        method: "GET",
        headers: {},
      },
      timestamp: Date.now() / 1000,
    });

    mockServer.fireEvent(targetId, "Network.responseReceived", {
      requestId: "req-1",
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        mimeType: "text/html",
        encodedDataLength: 500,
        timing: {
          requestTime: Date.now() / 1000,
          sendStart: 0,
          sendEnd: 0.01,
          receiveHeadersEnd: 0.05,
        },
      },
      timestamp: Date.now() / 1000,
    });

    await new Promise((r) => setTimeout(r, 50));

    // With includeContent = true (default)
    const resultWithContent = await browser_network_export({
      target: targetId,
      includeContent: true,
    });

    const harWithContent = JSON.parse(await fs.readFile(resultWithContent.path, "utf-8"));
    expect(harWithContent.log.entries[0].response.content).toBeDefined();
    expect(harWithContent.log.entries[0].response.content.size).toBe(500);

    await fs.unlink(resultWithContent.path);
    clearNetworkBuffer(targetId);

    // Re-populate buffer
    await browser_network({ target: targetId, enable: true });
    mockServer.fireEvent(targetId, "Network.requestWillBeSent", {
      requestId: "req-2",
      request: {
        url: "https://example2.com",
        method: "GET",
        headers: {},
      },
      timestamp: Date.now() / 1000,
    });

    mockServer.fireEvent(targetId, "Network.responseReceived", {
      requestId: "req-2",
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        mimeType: "text/html",
        encodedDataLength: 500,
        timing: {
          requestTime: Date.now() / 1000,
          sendStart: 0,
          sendEnd: 0.01,
          receiveHeadersEnd: 0.05,
        },
      },
      timestamp: Date.now() / 1000,
    });

    await new Promise((r) => setTimeout(r, 50));

    // With includeContent = false
    const resultWithoutContent = await browser_network_export({
      target: targetId,
      includeContent: false,
    });

    const harWithoutContent = JSON.parse(await fs.readFile(resultWithoutContent.path, "utf-8"));
    expect(harWithoutContent.log.entries[0].response.content).toBeUndefined();

    await fs.unlink(resultWithoutContent.path);
  });
});

describe("P2-04: browser_network_export path handling", () => {
  let mockServer: MockCDPServer;
  let targetId: string;
  const MOCK_PORT = 19225;
  const customPath = join(homedir(), ".cache", "pi-browser", "har", "custom-test.har");

  beforeAll(async () => {
    mockServer = new MockCDPServer(MOCK_PORT);
    await mockServer.start();

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
    clearNetworkBuffer(targetId);
  });

  it("should auto-generate path with timestamp when path not provided", async () => {
    const result = await browser_network_export({ target: targetId });

    // Verify default path format
    expect(result.path).toContain(join(homedir(), ".cache", "pi-browser", "har"));
    expect(result.path).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.har$/);

    // Verify file exists
    const stats = await fs.stat(result.path);
    expect(stats.isFile()).toBe(true);

    // Cleanup
    await fs.unlink(result.path);
  });

  it("should save to custom path when provided", async () => {
    // Ensure directory exists
    await fs.mkdir(dirname(customPath), { recursive: true });

    const result = await browser_network_export({
      target: targetId,
      path: customPath,
    });

    expect(result.path).toBe(customPath);

    const stats = await fs.stat(customPath);
    expect(stats.isFile()).toBe(true);

    // Cleanup
    await fs.unlink(customPath);
  });

  it("should create nested directories if needed", async () => {
    const nestedPath = join(
      homedir(),
      ".cache",
      "pi-browser",
      "har",
      "nested",
      "deep",
      "test.har"
    );

    const result = await browser_network_export({
      target: targetId,
      path: nestedPath,
    });

    expect(result.path).toBe(nestedPath);

    const stats = await fs.stat(nestedPath);
    expect(stats.isFile()).toBe(true);

    // Cleanup
    await fs.unlink(nestedPath);
    await fs.rmdir(join(homedir(), ".cache", "pi-browser", "har", "nested", "deep"));
    await fs.rmdir(join(homedir(), ".cache", "pi-browser", "har", "nested"));
  });

  it("should return correct file size", async () => {
    await browser_network({ target: targetId, enable: true });

    mockServer.fireEvent(targetId, "Network.requestWillBeSent", {
      requestId: "req-1",
      request: {
        url: "https://example.com",
        method: "GET",
        headers: {},
      },
      timestamp: Date.now() / 1000,
    });

    mockServer.fireEvent(targetId, "Network.responseReceived", {
      requestId: "req-1",
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        mimeType: "text/html",
        encodedDataLength: 100,
        timing: {
          requestTime: Date.now() / 1000,
          sendStart: 0,
          sendEnd: 0.01,
          receiveHeadersEnd: 0.05,
        },
      },
      timestamp: Date.now() / 1000,
    });

    await new Promise((r) => setTimeout(r, 50));

    const result = await browser_network_export({ target: targetId });

    expect(result.size).toBeGreaterThan(0);

    const fileContent = await fs.readFile(result.path);
    expect(result.size).toBe(fileContent.length);

    // Cleanup
    await fs.unlink(result.path);
  });
});

// Helper function for dirname
function dirname(p: string): string {
  return join(p, "..");
}
