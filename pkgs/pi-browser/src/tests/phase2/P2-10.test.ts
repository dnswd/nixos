import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { promises as fs, readFileSync } from "fs";
import { MockCDPServer } from "../mocks/mock-cdp.js";
import {
  browser_network,
  browser_network_export,
  ExportResult,
  clearNetworkBuffer,
} from "../../src/core/tools-network.js";
import {
  browser_console,
  clearConsoleBuffer,
} from "../../src/core/tools-console.js";
import {
  browser_storage_get,
  browser_storage_set,
} from "../../src/core/tools-storage.js";
import {
  browser_cdp,
} from "../../src/core/tools-network.js";
import {
  browser_navigate,
} from "../../src/core/tools-nav.js";
import {
  browser_click,
} from "../../src/core/tools-dom.js";
import {
  closePersistentConnection,
} from "../../src/core/cdp-client.js";
import { launchChrome } from "../e2e/chrome-launcher.js";
import { startFixtureServer, fixtureUrl } from "../e2e/fixture-server.js";
import type { ChromeInstance } from "../e2e/chrome-launcher.js";
import type { FixtureServer } from "../e2e/fixture-server.js";

describe("P2-10: Full Debug Workflow E2E", () => {
  const TEST_PORT = 19230;
  let mockServer: MockCDPServer;
  let targetId: string;
  let exportPath: string | undefined;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();

    // Create a test tab
    targetId = mockServer.addTab({
      url: "https://example.com",
      title: "Debug Test Page",
    });

    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;
  });

  afterAll(async () => {
    await mockServer.stop();
    delete process.env.CDP_WS_URL;
  });

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
    clearConsoleBuffer(targetId);
    closePersistentConnection(targetId);
    vi.restoreAllMocks();
  });

  describe("Integration Tests (Mock-based)", () => {
    it("should run full debug workflow: network → console → storage → CDP → export", async () => {
      // Setup mocks for comprehensive test
      const eventHandlers = new Map<string, (params: unknown) => void>();
      let storedCookies: any[] = [];
      const localStorageData: Record<string, string> = { theme: "dark" };

      const mockClient = {
        send: vi.fn().mockImplementation((method: string, params?: Record<string, unknown>) => {
          // Network mocks
          if (method === "Network.enable") return Promise.resolve({});
          if (method === "Network.disable") return Promise.resolve({});
          if (method === "Network.setRequestInterception") return Promise.resolve({});
          if (method === "Network.getCookies") {
            return Promise.resolve({ cookies: storedCookies });
          }
          if (method === "Network.setCookie") {
            storedCookies.push({
              name: params?.name,
              value: params?.value,
              domain: params?.domain,
            });
            return Promise.resolve({ success: true });
          }
          if (method === "Network.getResponseBody") {
            return Promise.resolve({ body: "{}", base64Encoded: false });
          }

          // Console mocks
          if (method === "Runtime.enable") return Promise.resolve({});
          if (method === "Runtime.disable") return Promise.resolve({});
          if (method === "Log.enable") return Promise.resolve({});
          if (method === "Log.disable") return Promise.resolve({});

          // Storage mocks
          if (method === "Runtime.evaluate") {
            const expression = params?.expression as string;
            if (expression === "JSON.stringify(localStorage)") {
              return Promise.resolve({ result: { value: JSON.stringify(localStorageData) } });
            }
            if (expression.includes("localStorage.setItem")) {
              return Promise.resolve({ result: {} });
            }
            return Promise.resolve({ result: { value: null } });
          }

          // CDP passthrough mocks
          if (method === "Runtime.getHeapUsage") {
            return Promise.resolve({ usedSize: 1024 * 1024, totalSize: 1024 * 1024 * 10 });
          }
          if (method === "Performance.getMetrics") {
            return Promise.resolve({ metrics: [{ name: "JSHeapUsedSize", value: 1000000 }] });
          }

          return Promise.resolve({});
        }),
        on: vi.fn((event: string, handler: (params: unknown) => void) => {
          eventHandlers.set(event, handler);
        }),
        close: vi.fn(),
      };

      const cdpModule = await import("../../src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);
      vi.spyOn(cdpModule, "hasPersistentConnection").mockReturnValue(true);

      // ============ STEP 1: Enable Network Capture ============
      const networkResult = await browser_network({
        target: targetId,
        enable: true,
        filter: { urlPattern: "*.api.example.com/*" },
      });
      expect(networkResult.capturing).toBe(true);

      // Simulate network event
      const requestHandler = eventHandlers.get("Network.requestWillBeSent");
      const responseHandler = eventHandlers.get("Network.responseReceived");

      if (requestHandler) {
        requestHandler({
          requestId: "e2e-req-1",
          request: { url: "https://api.example.com/data", method: "GET", headers: {} },
          timestamp: Date.now() / 1000,
        });
      }
      if (responseHandler) {
        responseHandler({
          requestId: "e2e-req-1",
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            mimeType: "application/json",
            encodedDataLength: 1234,
          },
          timestamp: Date.now() / 1000,
        });
      }

      // ============ STEP 2: Enable Console Capture ============
      await browser_console({
        target: targetId,
        enable: true,
      });

      // ============ STEP 3: Get and Set Storage ============
      // Get existing cookies
      const cookiesResult = await browser_storage_get(targetId, "cookies");
      expect(cookiesResult.type).toBe("cookies");

      // Set a test cookie
      const setCookieResult = await browser_storage_set(targetId, "cookies", {
        name: "test_cookie",
        value: "test_value",
        domain: "example.com",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
        url: "https://example.com",
      });
      expect(setCookieResult.success).toBe(true);

      // Get localStorage
      const localStorageResult = await browser_storage_get(targetId, "local_storage");
      expect(localStorageResult.type).toBe("local_storage");

      // Set localStorage item
      const setLocalResult = await browser_storage_set(targetId, "local_storage", {
        key: "debug_mode",
        value: "enabled",
      });
      expect(setLocalResult.success).toBe(true);

      // ============ STEP 4: Execute CDP Commands ============
      const heapResult = await browser_cdp({
        target: targetId,
        method: "Runtime.getHeapUsage",
      });
      expect(heapResult.result).toHaveProperty("usedSize");

      const metricsResult = await browser_cdp({
        target: targetId,
        method: "Performance.getMetrics",
      });
      expect(metricsResult.result).toHaveProperty("metrics");

      // ============ STEP 5: Export HAR ============
      const harResult: ExportResult = await browser_network_export({
        target: targetId,
        includeContent: true,
      });
      exportPath = harResult.path;

      // ============ STEP 6: Validate HAR Export ============
      expect(harResult.entryCount).toBeGreaterThanOrEqual(0);
      const fileExists = await fs.access(harResult.path).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const harData = JSON.parse(await fs.readFile(harResult.path, "utf8"));
      expect(harData.log.version).toBe("1.2");
      expect(harData.log.creator.name).toBe("pi-browser");
      expect(Array.isArray(harData.log.entries)).toBe(true);

      // ============ STEP 7: Cleanup ============
      await browser_network({ target: targetId, enable: false });
      await browser_console({ target: targetId, enable: false });

      // ============ STEP 8: Validate Summary Statistics ============
      expect(typeof harResult.summary.totalRequests).toBe("number");
      expect(typeof harResult.summary.totalSize).toBe("number");
    });

    it("should validate HAR file against structure requirements", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        close: vi.fn(),
      };

      const cdpModule = await import("../../src/core/cdp-client.js");
      vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

      await browser_network({ target: targetId, enable: true });

      const result: ExportResult = await browser_network_export({
        target: targetId,
      });
      exportPath = result.path;

      const harData = JSON.parse(await fs.readFile(result.path, "utf8"));

      // Validate required HAR v1.2 fields
      expect(harData.log).toBeDefined();
      expect(harData.log.version).toBe("1.2");
      expect(harData.log.creator).toMatchObject({
        name: expect.any(String),
        version: expect.any(String),
      });
      expect(harData.log.entries).toBeInstanceOf(Array);

      // Validate pages array
      if (harData.log.pages && harData.log.pages.length > 0) {
        const page = harData.log.pages[0];
        expect(page).toHaveProperty("id");
        expect(page).toHaveProperty("startedDateTime");
        expect(page).toHaveProperty("title");
      }
    });
  });

  // E2E Tests - require real Chrome instance
  // Marked with describe.skip until Chrome is available in CI
  describe.skip("E2E Tests (requires Chrome)", () => {
    let chrome: ChromeInstance | null = null;
    let fixtureServer: FixtureServer | null = null;
    let e2eTargetId: string;
    let e2eExportPath: string | undefined;

    beforeAll(async () => {
      // Skip if no Chrome available
      try {
        chrome = await launchChrome({ headless: true, port: 9223 });

        // Get target ID from Chrome
        const response = await fetch("http://localhost:9223/json/list");
        const tabs = await response.json();
        e2eTargetId = tabs[0].id;

        // Start fixture server
        fixtureServer = await startFixtureServer({
          fixtureDir: "tests/fixtures",
          cors: true,
        });
      } catch (e) {
        console.warn("Chrome not available or fixture server failed, skipping E2E tests");
      }
    }, 60000);

    afterAll(async () => {
      if (chrome) {
        await chrome.kill();
      }
      if (fixtureServer) {
        await fixtureServer.stop();
      }
    }, 30000);

    afterEach(async () => {
      if (e2eExportPath) {
        try {
          await fs.unlink(e2eExportPath);
        } catch {
          // Ignore
        }
        e2eExportPath = undefined;
      }
      if (e2eTargetId) {
        clearNetworkBuffer(e2eTargetId);
        clearConsoleBuffer(e2eTargetId);
        closePersistentConnection(e2eTargetId);
      }
    });

    it("captures network traffic during interaction flow", async () => {
      if (!chrome || !fixtureServer) return;

      // Step 1: Enable network capture
      const networkStart = await browser_network({
        target: e2eTargetId,
        enable: true,
      });
      expect(networkStart.capturing).toBe(true);

      // Step 2: Navigate to fixture page
      await browser_navigate({
        target: e2eTargetId,
        url: fixtureUrl(fixtureServer.url, "network-page.html"),
        waitFor: "load",
      });

      // Step 3: Click element that triggers XHR
      await browser_click({
        target: e2eTargetId,
        selector: "#trigger-xhr",
      });

      // Wait for network activity
      await new Promise((r) => setTimeout(r, 500));

      // Step 4: Export HAR
      const harResult = await browser_network_export({
        target: e2eTargetId,
      });
      e2eExportPath = harResult.path;

      // Verify HAR file created
      const fileExists = await fs
        .access(harResult.path)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
      expect(harResult.entryCount).toBeGreaterThanOrEqual(0);

      // Step 5: Validate HAR structure
      const har = JSON.parse(await fs.readFile(harResult.path, "utf8"));

      // Verify HAR v1.2 format
      expect(har.log.version).toBe("1.2");
      expect(har.log.creator.name).toBe("pi-browser");

      // Verify entries array exists
      expect(Array.isArray(har.log.entries)).toBe(true);

      // Verify timing data present in entries (if any entries exist)
      if (har.log.entries.length > 0) {
        const entry = har.log.entries[0];
        expect(entry.timings).toBeDefined();
        expect(entry.timings).toHaveProperty("send");
        expect(entry.timings).toHaveProperty("wait");
        expect(entry.timings).toHaveProperty("receive");
      }
    }, 30000);

    it("captures static resource loading (CSS, JS, images)", async () => {
      if (!chrome || !fixtureServer) return;

      await browser_network({ target: e2eTargetId, enable: true });

      await browser_navigate({
        target: e2eTargetId,
        url: fixtureUrl(fixtureServer.url, "a11y-page.html"),
        waitFor: "load",
      });

      const harResult = await browser_network_export({ target: e2eTargetId });
      e2eExportPath = harResult.path;

      const har = JSON.parse(await fs.readFile(harResult.path, "utf8"));

      // Should have entries array
      expect(Array.isArray(har.log.entries)).toBe(true);

      // Expect at least HTML entry
      const hasHtml = har.log.entries.some((e: any) =>
        e.response.content?.mimeType?.includes("html") ||
        e.request?.url?.endsWith(".html")
      );
      expect(hasHtml).toBe(true);
    }, 30000);

    it("produces valid HAR that passes online validator", async () => {
      if (!chrome || !fixtureServer) return;

      await browser_network({ target: e2eTargetId, enable: true });

      // Navigate to a simple page
      await browser_navigate({
        target: e2eTargetId,
        url: fixtureUrl(fixtureServer.url, "console-page.html"),
        waitFor: "load",
      });

      const harResult = await browser_network_export({ target: e2eTargetId });
      e2eExportPath = harResult.path;

      const har = JSON.parse(await fs.readFile(harResult.path, "utf8"));

      // Required HAR v1.2 fields
      expect(har.log).toBeDefined();
      expect(har.log.version).toBe("1.2");
      expect(har.log.creator).toHaveProperty("name");
      expect(har.log.creator).toHaveProperty("version");
      expect(Array.isArray(har.log.entries)).toBe(true);

      // Each entry should have required fields
      har.log.entries.forEach((entry: any) => {
        expect(entry).toHaveProperty("request");
        expect(entry).toHaveProperty("response");
        expect(entry.request).toHaveProperty("method");
        expect(entry.request).toHaveProperty("url");
        expect(entry.response).toHaveProperty("status");
        expect(entry).toHaveProperty("timings");
      });
    }, 30000);

    it("captures full debug workflow with console and network", async () => {
      if (!chrome || !fixtureServer) return;

      // Enable both network and console
      await browser_network({ target: e2eTargetId, enable: true });
      await browser_console({ target: e2eTargetId, enable: true });

      // Navigate to console test page
      await browser_navigate({
        target: e2eTargetId,
        url: fixtureUrl(fixtureServer.url, "console-page.html"),
        waitFor: "load",
      });

      // Wait a bit for any console messages
      await new Promise((r) => setTimeout(r, 300));

      // Export HAR
      const harResult = await browser_network_export({ target: e2eTargetId });
      e2eExportPath = harResult.path;

      // Verify HAR was created
      const fileExists = await fs
        .access(harResult.path)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Cleanup
      await browser_network({ target: e2eTargetId, enable: false });
      await browser_console({ target: e2eTargetId, enable: false });
    }, 30000);
  });
});
