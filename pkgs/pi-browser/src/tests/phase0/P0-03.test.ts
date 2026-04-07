import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { browser_snap, SnapResult } from "../../src/core/tools-nav.js";
import { MockCDPServer } from "../mocks/mock-cdp.js";

describe("P0-03: browser_snap", () => {
  let mockServer: MockCDPServer;
  const PORT = 9335; // Use different port to avoid conflicts
  let targetId: string;

  beforeAll(async () => {
    mockServer = new MockCDPServer(PORT);
    await mockServer.start();

    // Override the browser URL for testing
    process.env.CDP_WS_URL = `ws://localhost:${PORT}/devtools/browser`;

    // Add a mock tab
    targetId = mockServer.addTab({
      url: "https://example.com",
      title: "Example Page"
    });
  });

  afterAll(async () => {
    await mockServer.stop();
    delete process.env.CDP_WS_URL;
  });

  it("should capture accessibility tree with interactive elements", async () => {
    const result = await browser_snap({ target: targetId, compact: true });

    // Verify result structure
    expect(result).toHaveProperty("tree");
    expect(result).toHaveProperty("interactiveElements");
    expect(typeof result.tree).toBe("string");
    expect(Array.isArray(result.interactiveElements)).toBe(true);
  });

  it("should return interactive elements in compact mode", async () => {
    const result = await browser_snap({ target: targetId, compact: true });

    // Should have interactive elements (button, link, textbox, checkbox)
    expect(result.interactiveElements.length).toBeGreaterThan(0);

    // Each element should have role and name
    result.interactiveElements.forEach((element) => {
      expect(element).toHaveProperty("role");
      expect(element).toHaveProperty("name");
      expect(typeof element.role).toBe("string");
      expect(typeof element.name).toBe("string");
    });
  });

  it("should format compact mode as [role] \"name\" (selector)", async () => {
    const result = await browser_snap({ target: targetId, compact: true });

    // Tree should contain formatted lines
    const lines = result.tree.split("\n").filter((line) => line.trim() !== "");

    // Each line should match the pattern [role] "name"
    lines.forEach((line) => {
      expect(line).toMatch(/^\[\w+\] "[^"]+"/);
    });

    // Should have elements from mock: button, link, textbox, checkbox
    const hasButton = lines.some((line) => line.includes('[button] "Submit"'));
    const hasLink = lines.some((line) => line.includes('[link] "About us"'));
    const hasTextbox = lines.some((line) => line.includes('[textbox] "Email"'));
    const hasCheckbox = lines.some((line) => line.includes('[checkbox] "Remember me"'));

    expect(hasButton).toBe(true);
    expect(hasLink).toBe(true);
    expect(hasTextbox).toBe(true);
    expect(hasCheckbox).toBe(true);
  });

  it("should return full tree in non-compact mode", async () => {
    const result = await browser_snap({ target: targetId, compact: false });

    // Full tree should include non-interactive elements too
    expect(result.tree).toContain("[");
    expect(result.interactiveElements.length).toBeGreaterThan(0);
  });

  it("should return selector hints for interactive elements", async () => {
    const result = await browser_snap({ target: targetId, compact: true });

    // Each interactive element should have a selector hint
    result.interactiveElements.forEach((element) => {
      expect(element.selector).toBeDefined();
      expect(element.selector).toMatch(/^#element-\d+$/);
    });
  });

  it("should filter to interactive roles only in compact mode", async () => {
    const result = await browser_snap({ target: targetId, compact: true });

    // All elements should be interactive roles
    const interactiveRoles = [
      "button", "link", "textbox", "checkbox", "radio", "combobox",
      "menu", "menuitem", "tab", "treeitem", "listitem", "heading",
      "searchbox", "spinbutton", "slider", "switch"
    ];

    result.interactiveElements.forEach((element) => {
      expect(interactiveRoles).toContain(element.role.toLowerCase());
    });

    // RootWebArea should NOT be in interactive elements
    const hasRootWebArea = result.interactiveElements.some(
      (e) => e.role === "RootWebArea"
    );
    expect(hasRootWebArea).toBe(false);
  });

  it("should default to compact mode when compact not specified", async () => {
    const result = await browser_snap({ target: targetId });

    // Should behave like compact mode
    expect(result.interactiveElements.length).toBeGreaterThan(0);
    const lines = result.tree.split("\n").filter((line) => line.trim() !== "");
    lines.forEach((line) => {
      expect(line).toMatch(/^\[\w+\]/);
    });
  });
});
