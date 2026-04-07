import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MockCDPServer } from "../mocks/mock-cdp.js";
import { browser_storage } from "../../src/core/tools-storage.js";

describe("P2-07: Storage cookies get/set/delete", () => {
  let mockServer: MockCDPServer;
  const TEST_PORT = 19230;
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

  it("getCookies returns all cookies for domain", async () => {
    mockServer.setCookies(targetId, [
      { name: "session", value: "abc123", domain: ".example.com", path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
      { name: "preferences", value: "dark_mode", domain: "example.com", path: "/", httpOnly: false, secure: false },
    ]);

    const result = await browser_storage({
      target: targetId,
      action: "getCookies",
    });

    expect(result.cookies).toHaveLength(2);
    expect(result.cookies?.[0].name).toBe("session");
    expect(result.cookies?.[0].httpOnly).toBe(true);
  });

  it("setCookie creates new cookie", async () => {
    await browser_storage({
      target: targetId,
      action: "setCookie",
      name: "auth_token",
      value: "Bearer xyz789",
      domain: ".example.com",
      path: "/api",
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    });

    const result = await browser_storage({ target: targetId, action: "getCookies" });

    const authCookie = result.cookies?.find((c) => c.name === "auth_token");
    expect(authCookie).toBeDefined();
    expect(authCookie?.value).toBe("Bearer xyz789");
    expect(authCookie?.httpOnly).toBe(true);
    expect(authCookie?.sameSite).toBe("Strict");
  });

  it("setCookie updates existing cookie", async () => {
    // Create initial cookie
    await browser_storage({
      target: targetId,
      action: "setCookie",
      name: "counter",
      value: "1",
      domain: "example.com",
    });

    // Update it
    await browser_storage({
      target: targetId,
      action: "setCookie",
      name: "counter",
      value: "2",
      domain: "example.com",
    });

    const result = await browser_storage({ target: targetId, action: "getCookies" });
    const cookie = result.cookies?.find((c) => c.name === "counter");

    expect(cookie?.value).toBe("2");
    expect(result.cookies?.filter((c) => c.name === "counter")).toHaveLength(1);
  });

  it("deleteCookies removes specific cookie by name and URL", async () => {
    // Setup cookies
    mockServer.setCookies(targetId, [
      { name: "keep", value: "keep_value", domain: "example.com", path: "/", httpOnly: false, secure: false },
      { name: "remove", value: "remove_value", domain: "example.com", path: "/", httpOnly: false, secure: false },
    ]);

    await browser_storage({
      target: targetId,
      action: "deleteCookies",
      name: "remove",
      url: "https://example.com/",
    });

    const result = await browser_storage({ target: targetId, action: "getCookies" });

    expect(result.cookies).toHaveLength(1);
    expect(result.cookies?.[0].name).toBe("keep");
  });

  it("deleteCookies without URL removes all matching name", async () => {
    mockServer.setCookies(targetId, [
      { name: "session", value: "v1", domain: "sub1.example.com", path: "/", httpOnly: false, secure: false },
      { name: "session", value: "v2", domain: "sub2.example.com", path: "/", httpOnly: false, secure: false },
      { name: "other", value: "keep", domain: "example.com", path: "/", httpOnly: false, secure: false },
    ]);

    await browser_storage({
      target: targetId,
      action: "deleteCookies",
      name: "session",
    });

    const result = await browser_storage({ target: targetId, action: "getCookies" });

    expect(result.cookies).toHaveLength(1);
    expect(result.cookies?.[0].name).toBe("other");
  });

  it("handles cookie with all properties", async () => {
    const expires = Math.floor(Date.now() / 1000) + 86400; // Tomorrow

    await browser_storage({
      target: targetId,
      action: "setCookie",
      name: "full_cookie",
      value: "full_value",
      domain: ".example.com",
      path: "/path",
      httpOnly: true,
      secure: true,
      sameSite: "None",
      expires,
    });

    const result = await browser_storage({ target: targetId, action: "getCookies" });
    const cookie = result.cookies?.find((c) => c.name === "full_cookie");

    expect(cookie).toMatchObject({
      name: "full_cookie",
      value: "full_value",
      domain: ".example.com",
      path: "/path",
      httpOnly: true,
      secure: true,
      sameSite: "None",
      expires,
    });
  });

  it("returns empty array when no cookies", async () => {
    mockServer.clearCookies(targetId);

    const result = await browser_storage({ target: targetId, action: "getCookies" });

    expect(result.cookies).toEqual([]);
  });

  it("filters cookies by URL when specified", async () => {
    mockServer.setCookies(targetId, [
      { name: "a", value: "1", domain: "api.example.com", path: "/", httpOnly: false, secure: false },
      { name: "b", value: "2", domain: "www.example.com", path: "/", httpOnly: false, secure: false },
      { name: "c", value: "3", domain: "other.com", path: "/", httpOnly: false, secure: false },
    ]);

    const result = await browser_storage({
      target: targetId,
      action: "getCookies",
      urls: ["https://api.example.com/"],
    });

    expect(result.cookies).toHaveLength(1);
    expect(result.cookies?.[0].name).toBe("a");
  });
});
