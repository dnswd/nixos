import { describe, it, expect, afterEach, vi } from "vitest";
import {
  browser_storage_clear,
  browser_storage_get,
  browser_storage_delete,
} from "../../config/devel/pi-mono/extensions/pi-browser/src/core/tools-storage.js";

describe("P2-08: Storage Clear", () => {
  const targetId = "storage-clear-target";
  let mockClient: { send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let localStorageData: Record<string, string>;
  let sessionStorageData: Record<string, string>;
  let cookiesData: { name: string; value: string; domain: string }[];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setupMockClient() {
    localStorageData = { key1: "value1", key2: "value2" };
    sessionStorageData = { session1: "svalue1" };
    cookiesData = [
      { name: "c1", value: "v1", domain: "example.com" },
      { name: "c2", value: "v2", domain: "example.com" },
    ];

    mockClient = {
      send: vi.fn().mockImplementation((method: string, params?: Record<string, unknown>) => {
        switch (method) {
          case "Network.getCookies": {
            return Promise.resolve({ cookies: cookiesData });
          }

          case "Storage.clearDataForOrigin": {
            const types = (params?.storageTypes as string)?.split(",") || [];

            if (types.includes("local_storage")) {
              Object.keys(localStorageData).forEach((key) => delete localStorageData[key]);
            }

            if (types.includes("session_storage")) {
              Object.keys(sessionStorageData).forEach((key) => delete sessionStorageData[key]);
            }

            if (types.includes("cookies")) {
              cookiesData.length = 0;
            }

            return Promise.resolve({});
          }

          case "Runtime.evaluate": {
            const expression = params?.expression as string;

            if (expression === "JSON.stringify(localStorage)") {
              return Promise.resolve({
                result: { value: JSON.stringify(localStorageData) },
              });
            }

            if (expression === "JSON.stringify(sessionStorage)") {
              return Promise.resolve({
                result: { value: JSON.stringify(sessionStorageData) },
              });
            }

            if (expression.includes("localStorage.removeItem")) {
              const match = expression.match(/localStorage\.removeItem\((["'])(.+?)\1\)/);
              if (match) {
                delete localStorageData[match[2]];
              }
              return Promise.resolve({ result: {} });
            }

            if (expression.includes("sessionStorage.removeItem")) {
              const match = expression.match(/sessionStorage\.removeItem\((["'])(.+?)\1\)/);
              if (match) {
                delete sessionStorageData[match[2]];
              }
              return Promise.resolve({ result: {} });
            }

            if (expression === "window.location.origin") {
              return Promise.resolve({
                result: { value: "https://example.com" },
              });
            }

            return Promise.resolve({ result: { value: null } });
          }

          default:
            return Promise.resolve({});
        }
      }),
      close: vi.fn(),
    };

    const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
    vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);

    return { mockClient, localStorageData, sessionStorageData, cookiesData };
  }

  describe("Mock Tests", () => {
    it("should clear all localStorage", async () => {
      await setupMockClient();

      // Verify localStorage exists
      const before = await browser_storage_get(targetId, "local_storage");
      expect(before.count).toBeGreaterThan(0);

      // Clear localStorage
      await browser_storage_clear(targetId, ["local_storage"]);

      // Verify cleared
      const after = await browser_storage_get(targetId, "local_storage");
      expect(after.count).toBe(0);
    });

    it("should clear all sessionStorage", async () => {
      await setupMockClient();

      // Verify sessionStorage exists
      const before = await browser_storage_get(targetId, "session_storage");
      expect(before.count).toBeGreaterThan(0);

      // Clear sessionStorage
      await browser_storage_clear(targetId, ["session_storage"]);

      // Verify cleared
      const after = await browser_storage_get(targetId, "session_storage");
      expect(after.count).toBe(0);
    });

    it("should clear multiple storage types at once", async () => {
      await setupMockClient();

      // Clear both localStorage and cookies
      await browser_storage_clear(targetId, ["local_storage", "cookies"]);

      // Verify both are cleared
      const localAfter = await browser_storage_get(targetId, "local_storage");
      const cookiesAfter = await browser_storage_get(targetId, "cookies");

      expect(localAfter.count).toBe(0);
      expect(cookiesAfter.count).toBe(0);
    });

    it("should clear all storage types", async () => {
      await setupMockClient();

      // Clear all types
      await browser_storage_clear(targetId, [
        "cookies",
        "local_storage",
        "session_storage",
      ]);

      // Verify all are cleared
      const cookiesAfter = await browser_storage_get(targetId, "cookies");
      const localAfter = await browser_storage_get(targetId, "local_storage");
      const sessionAfter = await browser_storage_get(targetId, "session_storage");

      expect(cookiesAfter.count).toBe(0);
      expect(localAfter.count).toBe(0);
      expect(sessionAfter.count).toBe(0);
    });

    it("should delete specific localStorage key", async () => {
      await setupMockClient();

      const result = await browser_storage_delete(targetId, "local_storage", "key1");

      expect(result.type).toBe("local_storage");
      expect(result.deleted).toBe(1);

      // Verify key is deleted
      const remaining = await browser_storage_get(targetId, "local_storage");
      expect(remaining.count).toBe(1);
      expect((remaining.entries[0] as { key: string }).key).toBe("key2");
    });

    it("should delete specific sessionStorage key", async () => {
      await setupMockClient();

      const result = await browser_storage_delete(targetId, "session_storage", "session1");

      expect(result.type).toBe("session_storage");
      expect(result.deleted).toBe(1);

      // Verify key is deleted
      const remaining = await browser_storage_get(targetId, "session_storage");
      expect(remaining.count).toBe(0);
    });

    it("should get origin from current page for clear", async () => {
      await setupMockClient();

      await browser_storage_clear(targetId, ["local_storage"]);

      // Verify origin was fetched
      const calls = mockClient.send.mock.calls;
      const originCall = calls.find(
        (call: any[]) => call[0] === "Runtime.evaluate" &&
          call[1]?.expression === "window.location.origin",
      );

      expect(originCall).toBeDefined();
    });

    it("should pass correct storage types to CDP", async () => {
      await setupMockClient();

      await browser_storage_clear(targetId, ["cookies", "local_storage"]);

      const calls = mockClient.send.mock.calls;
      const clearCall = calls.find((call: any[]) => call[0] === "Storage.clearDataForOrigin");

      expect(clearCall).toBeDefined();
      expect(clearCall[1].storageTypes).toContain("cookies");
      expect(clearCall[1].storageTypes).toContain("local_storage");
    });
  });
});
