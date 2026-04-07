import { describe, it, expect, afterEach, vi } from "vitest";
import {
  browser_console,
  getConsoleEntries,
  getConsoleBufferSize,
  clearConsoleBuffer,
  unregisterConsoleTarget,
} from "../../src/core/tools-console.js";
import {
  closePersistentConnection,
} from "../../src/core/cdp-client.js";

describe("P2-05: Console Capture", () => {
  const targetId = "console-test-target";
  let eventHandlers: Map<string, (params: unknown) => void>;
  let mockClient: { send: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  afterEach(() => {
    clearConsoleBuffer(targetId);
    unregisterConsoleTarget(targetId);
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
    it("should capture console.log messages", async () => {
      await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      const consoleHandler = eventHandlers.get("Runtime.consoleAPICalled");

      if (consoleHandler) {
        consoleHandler({
          type: "log",
          args: [{ value: "Hello, World!" }],
          timestamp: Date.now(),
          executionContextId: 1,
          stackTrace: {
            callFrames: [
              {
                functionName: "testFunction",
                url: "https://example.com/app.js",
                lineNumber: 42,
                columnNumber: 10,
              },
            ],
          },
        });
      }

      const entries = getConsoleEntries(targetId);
      expect(entries.length).toBe(1);
      expect(entries[0].level).toBe("log");
      expect(entries[0].message).toBe("Hello, World!");
    });

    it("should capture console.error with stack trace", async () => {
      await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      const consoleHandler = eventHandlers.get("Runtime.consoleAPICalled");

      if (consoleHandler) {
        consoleHandler({
          type: "error",
          args: [{ value: "Error: Something went wrong" }],
          timestamp: Date.now(),
          executionContextId: 1,
          stackTrace: {
            callFrames: [
              { functionName: "funcA", url: "https://example.com/a.js", lineNumber: 10, columnNumber: 5 },
              { functionName: "funcB", url: "https://example.com/b.js", lineNumber: 20, columnNumber: 8 },
              { functionName: "funcC", url: "https://example.com/c.js", lineNumber: 30, columnNumber: 12 },
            ],
          },
        });
      }

      const entries = getConsoleEntries(targetId);
      expect(entries.length).toBe(1);
      expect(entries[0].level).toBe("error");
      expect(entries[0].stackTrace).toBeDefined();
      expect(entries[0].stackTrace!.length).toBeLessThanOrEqual(5);
      expect(entries[0].stackTrace![0].functionName).toBe("funcA");
    });

    it("should capture all console levels", async () => {
      await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      const consoleHandler = eventHandlers.get("Runtime.consoleAPICalled");

      const levels = ["log", "debug", "info", "error", "warning"];

      for (const level of levels) {
        if (consoleHandler) {
          consoleHandler({
            type: level,
            args: [{ value: `Test ${level}` }],
            timestamp: Date.now(),
            executionContextId: 1,
          });
        }
      }

      const entries = getConsoleEntries(targetId);
      expect(entries.length).toBe(5);
      const entryLevels = entries.map((e) => e.level).sort();
      expect(entryLevels).toContain("debug");
      expect(entryLevels).toContain("error");
      expect(entryLevels).toContain("info");
      expect(entryLevels).toContain("log");
      expect(entryLevels).toContain("warning");
    });

    it("should capture Log.entryAdded events", async () => {
      await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      const logHandler = eventHandlers.get("Log.entryAdded");

      if (logHandler) {
        logHandler({
          entry: {
            level: "error",
            text: "CSP violation: script-src",
            source: "security",
            url: "https://example.com/page",
            lineNumber: 15,
            columnNumber: 8,
            timestamp: Date.now(),
          },
        });
      }

      const entries = getConsoleEntries(targetId);
      expect(entries.length).toBe(1);
      expect(entries[0].level).toBe("error");
      expect(entries[0].message).toContain("CSP violation");
      expect(entries[0].source).toBe("https://example.com/page");
    });

    it("should enable both Runtime and Log domains", async () => {
      const { mockClient } = await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      // Verify both domains were enabled
      const calls = mockClient.send.mock.calls;
      const enabledMethods = calls
        .filter((call: any[]) =>
          ["Runtime.enable", "Log.enable"].includes(call[0]),
        )
        .map((call: any[]) => call[0]);

      expect(enabledMethods).toContain("Runtime.enable");
      expect(enabledMethods).toContain("Log.enable");
    });

    it("should clear buffer on fresh enable", async () => {
      await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      const consoleHandler = eventHandlers.get("Runtime.consoleAPICalled");

      if (consoleHandler) {
        consoleHandler({
          type: "log",
          args: [{ value: "First message" }],
          timestamp: Date.now(),
          executionContextId: 1,
        });
      }

      expect(getConsoleBufferSize(targetId)).toBe(1);

      // Re-enable with clear: true should clear buffer
      await browser_console({ target: targetId, enable: true, clear: true });
      expect(getConsoleBufferSize(targetId)).toBe(0);
    });

    it("should return entry count when disabled", async () => {
      await setupMockClient();

      await browser_console({ target: targetId, enable: true });

      const consoleHandler = eventHandlers.get("Runtime.consoleAPICalled");

      if (consoleHandler) {
        for (let i = 0; i < 3; i++) {
          consoleHandler({
            type: "log",
            args: [{ value: `Message ${i}` }],
            timestamp: Date.now(),
            executionContextId: 1,
          });
        }
      }

      const result = await browser_console({ target: targetId, enable: false });
      expect(result.capturing).toBe(false);
      expect(result.entriesCount).toBe(3);
    });
  });
});
