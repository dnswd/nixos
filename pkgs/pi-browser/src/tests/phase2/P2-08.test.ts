import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MockCDPServer } from "../mocks/mock-cdp.js";
import { browser_storage } from "../../src/core/tools-storage.js";

describe("P2-08: Storage localStorage get/set/clear", () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 19231;
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(TEST_PORT);
    await mockServer.start();
    targetId = mockServer.addTab({ url: "https://example.com", title: "Example" });
    process.env.CDP_WS_URL = `ws://localhost:${TEST_PORT}/devtools/browser`;
  });

  afterAll(async () => {
    await mockServer.stop();
    delete process.env.CDP_WS_URL;
  });

  beforeEach(() => {
    mockServer.clearLocalStorage(targetId);
  });

  it("getLocalStorage returns all key-value pairs", async () => {
    mockServer.setLocalStorage(targetId, {
      user_id: "12345",
      theme: "dark",
      last_visit: "2024-01-15",
    });

    const result = await browser_storage({
      target: targetId,
      action: "getLocalStorage",
    });

    expect(result.localStorage).toEqual({
      user_id: "12345",
      theme: "dark",
      last_visit: "2024-01-15",
    });
  });

  it("setLocalStorage creates new entry", async () => {
    await browser_storage({
      target: targetId,
      action: "setLocalStorage",
      key: "api_key",
      value: "sk-abc123xyz",
    });

    const result = await browser_storage({ target: targetId, action: "getLocalStorage" });

    expect(result.localStorage?.["api_key"]).toBe("sk-abc123xyz");
  });

  it("setLocalStorage updates existing entry", async () => {
    // Set initial
    await browser_storage({
      target: targetId,
      action: "setLocalStorage",
      key: "counter",
      value: "10",
    });

    // Update
    await browser_storage({
      target: targetId,
      action: "setLocalStorage",
      key: "counter",
      value: "11",
    });

    const result = await browser_storage({ target: targetId, action: "getLocalStorage" });

    expect(result.localStorage?.["counter"]).toBe("11");
    expect(Object.keys(result.localStorage || {})).toHaveLength(1);
  });

  it("handles complex values (JSON)", async () => {
    const complexData = JSON.stringify({ user: "john", prefs: { lang: "en", notifications: true } });

    await browser_storage({
      target: targetId,
      action: "setLocalStorage",
      key: "user_data",
      value: complexData,
    });

    const result = await browser_storage({ target: targetId, action: "getLocalStorage" });
    const parsed = JSON.parse(result.localStorage?.["user_data"] || "{}");

    expect(parsed.user).toBe("john");
    expect(parsed.prefs.lang).toBe("en");
  });

  it("handles empty string values", async () => {
    await browser_storage({
      target: targetId,
      action: "setLocalStorage",
      key: "empty_key",
      value: "",
    });

    const result = await browser_storage({ target: targetId, action: "getLocalStorage" });

    expect(result.localStorage?.["empty_key"]).toBe("");
  });

  it("handles special characters in keys and values", async () => {
    await browser_storage({
      target: targetId,
      action: "setLocalStorage",
      key: 'special!@#$%^&*()',
      value: 'value\nwith\t"quotes" and unicode: 中文',
    });

    const result = await browser_storage({ target: targetId, action: "getLocalStorage" });

    expect(result.localStorage?.['special!@#$%^&*()']).toContain("中文");
  });

  it("clearStorage removes all localStorage entries", async () => {
    // Setup data
    await browser_storage({ target: targetId, action: "setLocalStorage", key: "a", value: "1" });
    await browser_storage({ target: targetId, action: "setLocalStorage", key: "b", value: "2" });
    await browser_storage({ target: targetId, action: "setLocalStorage", key: "c", value: "3" });

    let result = await browser_storage({ target: targetId, action: "getLocalStorage" });
    expect(Object.keys(result.localStorage || {})).toHaveLength(3);

    // Clear
    await browser_storage({
      target: targetId,
      action: "clearStorage",
      types: ["local_storage"],
    });

    result = await browser_storage({ target: targetId, action: "getLocalStorage" });
    expect(result.localStorage).toEqual({});
  });

  it("returns empty object when localStorage is empty", async () => {
    const result = await browser_storage({ target: targetId, action: "getLocalStorage" });

    expect(result.localStorage).toEqual({});
  });

  it("persists across multiple calls", async () => {
    // Add entries one by one
    await browser_storage({ target: targetId, action: "setLocalStorage", key: "step1", value: "value1" });
    await browser_storage({ target: targetId, action: "setLocalStorage", key: "step2", value: "value2" });

    let result = await browser_storage({ target: targetId, action: "getLocalStorage" });
    expect(Object.keys(result.localStorage || {})).toHaveLength(2);

    // Add another
    await browser_storage({ target: targetId, action: "setLocalStorage", key: "step3", value: "value3" });

    result = await browser_storage({ target: targetId, action: "getLocalStorage" });
    expect(Object.keys(result.localStorage || {})).toHaveLength(3);
    expect(result.localStorage?.["step1"]).toBe("value1");
  });
});
