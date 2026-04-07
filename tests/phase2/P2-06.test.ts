import { describe, it, expect, afterEach, vi } from "vitest";
import {
  browser_console,
  getConsoleEntries,
  getConsoleBufferSize,
  clearConsoleBuffer,
} from "../../config/devel/pi-mono/extensions/pi-browser/src/core/tools-console.js";
import {
  closePersistentConnection,
} from "../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js";

describe("P2-06: Console Clear", () => {
  const targetId = "console-clear-target";
  let eventHandlers: Map<string, (params: unknown) => void>;
  let mockClient: { send: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  afterEach(() => {
    clearConsoleBuffer(targetId);
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

    const cdpModule = await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js");
    vi.spyOn(cdpModule, "getCDPClient").mockResolvedValue(mockClient as any);
    vi.spyOn(cdpModule, "hasPersistentConnection").mockReturnValue(true);

    return { mockClient, eventHandlers };
  }

  describe("Mock Tests", () => {
    it("should disable Runtime and Log domains on stop", async () => {
      await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      mockClient.send.mockClear();

      await browser_console({ target: targetId, enable: false });

      const calls = mockClient.send.mock.calls;
      const disabledMethods = calls
        .filter((call: any[]) =>
          ["Runtime.disable", "Log.disable"].includes(call[0]),
        )
        .map((call: any[]) => call[0]);

      expect(disabledMethods).toContain("Runtime.disable");
      expect(disabledMethods).toContain("Log.disable");
    });

    it("should retain entries when disabling", async () => {
      await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      const consoleHandler = eventHandlers.get("Runtime.consoleAPICalled");

      // Add some console messages
      for (let i = 0; i < 5; i++) {
        if (consoleHandler) {
          consoleHandler({
            type: "log",
            args: [{ value: `Message ${i}` }],
            timestamp: Date.now(),
            executionContextId: 1,
          });
        }
      }

      const beforeCount = getConsoleBufferSize(targetId);
      expect(beforeCount).toBe(5);

      // Disable - should retain entries
      await browser_console({ target: targetId, enable: false });

      const entries = getConsoleEntries(targetId);
      expect(entries.length).toBe(5);
    });

    it("should handle disabling when not enabled", async () => {
      const { mockClient } = await setupMockClient();
      vi.spyOn(await import("../../config/devel/pi-mono/extensions/pi-browser/src/core/cdp-client.js"), "hasPersistentConnection")
        .mockReturnValue(false);

      const result = await browser_console({ target: targetId, enable: false });

      expect(result.capturing).toBe(false);
      expect(result.entriesCount).toBe(0);
    });

    it("should handle errors during disable gracefully", async () => {
      await setupMockClient();

      // Mock an error during disable
      mockClient.send.mockRejectedValueOnce(new Error("Connection lost"));

      // Should not throw
      const result = await browser_console({ target: targetId, enable: false });
      expect(result.capturing).toBe(false);
    });
  });
});
