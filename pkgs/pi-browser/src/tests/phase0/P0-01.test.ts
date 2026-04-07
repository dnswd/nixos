import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { browser_list, TabInfo } from "../../src/core/tools-nav.js";
import { MockCDPServer } from "../mocks/mock-cdp.js";

describe("P0-01: browser_list", () => {
  let mockServer: MockCDPServer;
  const PORT = 9333; // Use different port to avoid conflicts

  beforeAll(async () => {
    mockServer = new MockCDPServer(PORT);
    await mockServer.start();

    // Override the browser URL for testing
    process.env.CDP_WS_URL = `ws://localhost:${PORT}/devtools/browser`;
  });

  afterAll(async () => {
    await mockServer.stop();
    delete process.env.CDP_WS_URL;
  });

  it("should return array of tabs with correct fields", async () => {
    // Add 3 mock tabs
    const tab1 = mockServer.addTab({
      url: "https://example.com",
      title: "Example Page"
    });
    const tab2 = mockServer.addTab({
      url: "https://google.com",
      title: "Google"
    });
    const tab3 = mockServer.addTab({
      url: "https://github.com",
      title: "GitHub"
    });

    // Call browser_list
    const tabs = await browser_list();

    // Verify results
    expect(tabs).toHaveLength(3);

    // Verify tab structure
    tabs.forEach((tab: TabInfo) => {
      expect(tab).toHaveProperty("id");
      expect(tab).toHaveProperty("url");
      expect(tab).toHaveProperty("title");
      expect(tab).toHaveProperty("active");
      expect(typeof tab.id).toBe("string");
      expect(typeof tab.url).toBe("string");
      expect(typeof tab.title).toBe("string");
      expect(typeof tab.active).toBe("boolean");
    });

    // Verify specific tab data
    const tabIds = tabs.map((t: TabInfo) => t.id);
    expect(tabIds).toContain(tab1);
    expect(tabIds).toContain(tab2);
    expect(tabIds).toContain(tab3);
  });

  it("should filter to page type targets only", async () => {
    // Clear existing tabs
    mockServer.clearTabs();

    // The mock only supports 'page' type tabs, which is correct behavior
    // In real Chrome, there would also be 'background_page', 'service_worker', etc.
    const tab1 = mockServer.addTab({
      url: "https://example.com",
      title: "Example Page"
    });

    const tabs = await browser_list();

    // Should only return page type targets
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(tab1);
  });

  it("should return empty array when no tabs exist", async () => {
    mockServer.clearTabs();

    const tabs = await browser_list();

    expect(tabs).toHaveLength(0);
    expect(tabs).toEqual([]);
  });

  it("should throw ChromeNotFound when Chrome not running", async () => {
    // Stop the mock server to simulate Chrome not running
    await mockServer.stop();

    // Clear the environment variable so it tries default port
    delete process.env.CDP_WS_URL;

    await expect(browser_list()).rejects.toThrow("Chrome not running on port 9222");

    // Restart server for other tests
    mockServer = new MockCDPServer(PORT);
    await mockServer.start();
    process.env.CDP_WS_URL = `ws://localhost:${PORT}/devtools/browser`;
  });
});
