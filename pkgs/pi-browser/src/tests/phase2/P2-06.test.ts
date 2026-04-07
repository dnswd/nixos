import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { MockCDPServer } from "../mocks/mock-cdp.js";
import {
  browser_console,
  clearConsoleBuffer,
  getConsoleEntries,
  addConsoleEntry,
} from "../../src/core/tools-console.js";

describe("P2-06: Console clear resets buffer", () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 19229;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();
    targetId = mockServer.addTab({
      url: "https://example.com",
      title: "Example",
    });
    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;
  });

  afterAll(async () => {
    await mockServer.stop();
    delete process.env.CDP_WS_URL;
  });

  beforeEach(() => {
    clearConsoleBuffer(targetId);
  });

  afterEach(() => {
    clearConsoleBuffer(targetId);
  });

  describe("Direct buffer tests", () => {
    it("clears all console entries when clear=true", async () => {
      // Add some logs directly to buffer
      addConsoleEntry(targetId, {
        level: "log",
        message: "Message 1",
        source: "test",
        timestamp: Date.now(),
      });
      addConsoleEntry(targetId, {
        level: "log",
        message: "Message 2",
        source: "test",
        timestamp: Date.now(),
      });

      // Verify logs exist
      let logs = getConsoleEntries(targetId);
      expect(logs).toHaveLength(2);

      // Enable with clear
      await browser_console({ target: targetId, enable: true, clear: true });

      // Buffer should be empty
      logs = getConsoleEntries(targetId);
      expect(logs).toHaveLength(0);
    });

    it("preserves entries when clear=false or not specified", async () => {
      // Add log directly
      addConsoleEntry(targetId, {
        level: "log",
        message: "Preserved",
        source: "test",
        timestamp: Date.now(),
      });

      // Enable without clear
      await browser_console({ target: targetId, enable: true });

      // Entry should still exist
      const logs = getConsoleEntries(targetId);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain("Preserved");
    });

    it("resets circular buffer index on clear", async () => {
      // Fill buffer near limit
      for (let i = 0; i < 900; i++) {
        addConsoleEntry(targetId, {
          level: "log",
          message: `Message ${i}`,
          source: "test",
          timestamp: Date.now(),
        });
      }

      expect(getConsoleEntries(targetId)).toHaveLength(900);

      // Clear
      clearConsoleBuffer(targetId);

      // Buffer should be empty, index reset
      expect(getConsoleEntries(targetId)).toHaveLength(0);

      // Can add more entries without immediate eviction
      for (let i = 0; i < 100; i++) {
        addConsoleEntry(targetId, {
          level: "log",
          message: `New ${i}`,
          source: "test",
          timestamp: Date.now(),
        });
      }

      expect(getConsoleEntries(targetId)).toHaveLength(100);
    });

    it("affects only specified target buffer", async () => {
      const targetId2 = mockServer.addTab({
        url: "https://other.com",
        title: "Other",
      });

      // Add logs to both targets
      addConsoleEntry(targetId, {
        level: "log",
        message: "Tab 1",
        source: "test",
        timestamp: 1,
      });
      addConsoleEntry(targetId2, {
        level: "log",
        message: "Tab 2",
        source: "test",
        timestamp: 2,
      });

      // Clear only target 1
      clearConsoleBuffer(targetId);

      expect(getConsoleEntries(targetId)).toHaveLength(0);
      expect(getConsoleEntries(targetId2)).toHaveLength(1);

      // Cleanup
      clearConsoleBuffer(targetId2);
    });

    it("works with disable action", async () => {
      // Add log
      addConsoleEntry(targetId, {
        level: "log",
        message: "Before",
        source: "test",
        timestamp: Date.now(),
      });

      // Disable and clear
      await browser_console({ target: targetId, enable: false, clear: true });

      const logs = getConsoleEntries(targetId);
      expect(logs).toHaveLength(0);
    });
  });
});
