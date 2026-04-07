import { getCDPClient, type CDPClient } from "./cdp-client.js";

// ============================================================================
// Storage Types
// ============================================================================

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface CookieParam extends Cookie {
  url?: string;
}

export type StorageType = "cookies" | "local_storage" | "session_storage";

// ============================================================================
// localStorage Operations
// ============================================================================

/**
 * Get localStorage entries via Runtime.evaluate
 */
async function getLocalStorage(cdp: CDPClient): Promise<Record<string, string>> {
  const result = await cdp.send("Runtime.evaluate", {
    expression: "JSON.stringify(localStorage)",
    returnByValue: true,
  }) as { result: { value: string } };
  return JSON.parse(result.result.value);
}

/**
 * Set localStorage item
 */
async function setLocalStorage(
  cdp: CDPClient,
  key: string,
  value: string,
): Promise<void> {
  const escapedKey = JSON.stringify(key);
  const escapedValue = JSON.stringify(value);

  await cdp.send("Runtime.evaluate", {
    expression: `localStorage.setItem(${escapedKey}, ${escapedValue})`,
    returnByValue: true,
  });
}

// ============================================================================
// SessionStorage Operations
// ============================================================================

/**
 * Get sessionStorage entries via Runtime.evaluate
 */
async function getSessionStorage(cdp: CDPClient): Promise<Record<string, string>> {
  const result = await cdp.send("Runtime.evaluate", {
    expression: "JSON.stringify(sessionStorage)",
    returnByValue: true,
  }) as { result: { value: string } };
  return JSON.parse(result.result.value);
}

/**
 * Set sessionStorage item
 */
async function setSessionStorage(
  cdp: CDPClient,
  key: string,
  value: string,
): Promise<void> {
  const escapedKey = JSON.stringify(key);
  const escapedValue = JSON.stringify(value);

  await cdp.send("Runtime.evaluate", {
    expression: `sessionStorage.setItem(${escapedKey}, ${escapedValue})`,
    returnByValue: true,
  });
}

// ============================================================================
// Clear Storage Operations
// ============================================================================

/**
 * Clear storage types using Storage.clearDataForOrigin
 */
async function clearStorage(
  cdp: CDPClient,
  types: string[],
): Promise<void> {
  // Get origin from current page
  const result = await cdp.send("Runtime.evaluate", {
    expression: "window.location.origin",
    returnByValue: true,
  }) as { result: { value: string } };

  await cdp.send("Storage.clearDataForOrigin", {
    origin: result.result.value,
    storageTypes: types.join(","),
  });
}

// ============================================================================
// Cookie Operations
// ============================================================================

interface CDPCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

interface NetworkGetCookiesResult {
  cookies: CDPCookie[];
}

interface NetworkSetCookieResult {
  success: boolean;
}

/**
 * Get cookies from the browser
 */
export async function getCookies(
  cdp: Awaited<ReturnType<typeof getCDPClient>>,
  urls?: string[],
): Promise<Cookie[]> {
  const result = (await cdp.send(
    "Network.getCookies",
    urls ? { urls } : {},
  )) as NetworkGetCookiesResult;

  return result.cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  }));
}

/**
 * Set a cookie
 */
export async function setCookie(
  cdp: Awaited<ReturnType<typeof getCDPClient>>,
  cookie: CookieParam,
): Promise<void> {
  const params: Record<string, unknown> = {
    name: cookie.name,
    value: cookie.value,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    priority: "Medium",
  };

  if (cookie.url) {
    params.url = cookie.url;
  }
  if (cookie.domain) {
    params.domain = cookie.domain;
  }
  if (cookie.path) {
    params.path = cookie.path;
  }
  if (cookie.sameSite) {
    params.sameSite = cookie.sameSite;
  }
  if (cookie.expires) {
    params.expires = cookie.expires;
  }

  const result = (await cdp.send(
    "Network.setCookie",
    params,
  )) as NetworkSetCookieResult;

  if (!result.success) {
    throw new Error(`Failed to set cookie: ${cookie.name}`);
  }
}

/**
 * Delete cookies by name
 */
export async function deleteCookies(
  cdp: Awaited<ReturnType<typeof getCDPClient>>,
  name: string,
  url?: string,
): Promise<void> {
  if (url) {
    // Delete specific cookie by name + URL
    await cdp.send("Network.deleteCookies", { name, url });
  } else {
    // Get all cookies and delete matching name
    const result = (await cdp.send("Network.getCookies")) as NetworkGetCookiesResult;
    const matchingCookies = result.cookies.filter((c) => c.name === name);

    for (const cookie of matchingCookies) {
      // Construct URL from cookie properties
      const protocol = cookie.secure ? "https" : "http";
      const domain = cookie.domain.startsWith(".")
        ? cookie.domain.substring(1)
        : cookie.domain;
      const cookieUrl = `${protocol}://${domain}${cookie.path}`;

      await cdp.send("Network.deleteCookies", { name, url: cookieUrl });
    }
  }
}

// ============================================================================
// Storage Tool Implementation
// ============================================================================

export interface StorageGetResult {
  type: StorageType;
  entries: Cookie[] | Array<{ key: string; value: string }>;
  count: number;
}

export interface StorageSetResult {
  type: StorageType;
  success: boolean;
}

export interface StorageDeleteResult {
  type: StorageType;
  deleted: number;
}

/**
 * Get storage entries (cookies, local_storage, session_storage)
 */
export async function browser_storage_get(
  target: string,
  type: StorageType,
  filter?: { name?: string; domain?: string },
): Promise<StorageGetResult> {
  const cdp = await getCDPClient(target);

  try {
    if (type === "cookies") {
      let urls: string[] | undefined;
      if (filter?.domain) {
        urls = [`https://${filter.domain}`, `http://${filter.domain}`];
      }

      let cookies = await getCookies(cdp, urls);

      // Filter by name if specified
      if (filter?.name) {
        cookies = cookies.filter((c) => c.name === filter.name);
      }

      return {
        type: "cookies",
        entries: cookies,
        count: cookies.length,
      };
    }

    if (type === "local_storage") {
      const storage = await getLocalStorage(cdp);
      const entries = Object.entries(storage).map(([key, value]) => ({ key, value }));

      // Filter by name (key) if specified
      let filtered = entries;
      if (filter?.name) {
        filtered = entries.filter((e) => e.key === filter.name);
      }

      return {
        type: "local_storage",
        entries: filtered,
        count: filtered.length,
      };
    }

    if (type === "session_storage") {
      const storage = await getSessionStorage(cdp);
      const entries = Object.entries(storage).map(([key, value]) => ({ key, value }));

      // Filter by name (key) if specified
      let filtered = entries;
      if (filter?.name) {
        filtered = entries.filter((e) => e.key === filter.name);
      }

      return {
        type: "session_storage",
        entries: filtered,
        count: filtered.length,
      };
    }

    throw new Error(`Unsupported storage type: ${type}`);
  } finally {
    cdp.close();
  }
}

/**
 * Set a storage entry (cookies, local_storage, session_storage)
 */
export async function browser_storage_set(
  target: string,
  type: StorageType,
  entry: CookieParam | { key: string; value: string; url?: string },
): Promise<StorageSetResult> {
  const cdp = await getCDPClient(target);

  try {
    if (type === "cookies") {
      await setCookie(cdp, entry as CookieParam);
      return { type: "cookies", success: true };
    }

    if (type === "local_storage") {
      const e = entry as { key: string; value: string };
      await setLocalStorage(cdp, e.key, e.value);
      return { type: "local_storage", success: true };
    }

    if (type === "session_storage") {
      const e = entry as { key: string; value: string };
      await setSessionStorage(cdp, e.key, e.value);
      return { type: "session_storage", success: true };
    }

    throw new Error(`Unsupported storage type: ${type}`);
  } finally {
    cdp.close();
  }
}

/**
 * Delete storage entries (cookies, local_storage, session_storage)
 */
export async function browser_storage_delete(
  target: string,
  type: StorageType,
  key: string,
  url?: string,
): Promise<StorageDeleteResult> {
  const cdp = await getCDPClient(target);

  try {
    if (type === "cookies") {
      await deleteCookies(cdp, key, url);
      return {
        type: "cookies",
        deleted: url ? 1 : -1, // -1 means "unknown, could be multiple"
      };
    }

    if (type === "local_storage") {
      // Use Runtime.evaluate to remove specific key
      const escapedKey = JSON.stringify(key);
      await cdp.send("Runtime.evaluate", {
        expression: `localStorage.removeItem(${escapedKey})`,
        returnByValue: true,
      });
      return { type: "local_storage", deleted: 1 };
    }

    if (type === "session_storage") {
      // Use Runtime.evaluate to remove specific key
      const escapedKey = JSON.stringify(key);
      await cdp.send("Runtime.evaluate", {
        expression: `sessionStorage.removeItem(${escapedKey})`,
        returnByValue: true,
      });
      return { type: "session_storage", deleted: 1 };
    }

    throw new Error(`Unsupported storage type: ${type}`);
  } finally {
    cdp.close();
  }
}

/**
 * Clear all storage types for the current origin
 */
export async function browser_storage_clear(
  target: string,
  types: StorageType[],
): Promise<void> {
  const cdp = await getCDPClient(target);

  try {
    // Map storage types to CDP storage type names
    const cdpTypes: string[] = [];
    for (const t of types) {
      switch (t) {
        case "cookies":
          cdpTypes.push("cookies");
          break;
        case "local_storage":
          cdpTypes.push("local_storage");
          break;
        case "session_storage":
          cdpTypes.push("session_storage");
          break;
      }
    }

    await clearStorage(cdp, cdpTypes);
  } finally {
    cdp.close();
  }
}

// ============================================================================
// Unified Storage Tool (for pi tool registration)
// ============================================================================

class BrowserError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "BrowserError";
  }
}

export type StorageAction =
  | "getCookies"
  | "setCookie"
  | "deleteCookies"
  | "getLocalStorage"
  | "setLocalStorage"
  | "clearStorage";

export interface StorageParams {
  target?: string;
  action: StorageAction;
  // For setCookie
  name?: string;
  value?: string;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  expires?: number;
  url?: string;
  // For setLocalStorage
  key?: string;
  // For clearStorage
  types?: string[];
  // For getCookies filtering
  urls?: string[];
}

export interface StorageResultUnified {
  success?: boolean;
  cookies?: Cookie[];
  localStorage?: Record<string, string>;
}

export async function browser_storage(
  params: StorageParams,
): Promise<StorageResultUnified> {
  const cdp = await getCDPClient(params.target || "default");

  try {
    switch (params.action) {
      case "getCookies": {
        const cookies = await getCookies(cdp, params.urls);
        return { cookies };
      }

      case "setCookie": {
        if (!params.name || !params.value) {
          throw new BrowserError(
            "InvalidParams",
            "name and value required for setCookie",
          );
        }
        await setCookie(cdp, {
          name: params.name,
          value: params.value,
          domain: params.domain || "",
          path: params.path || "/",
          httpOnly: params.httpOnly || false,
          secure: params.secure || false,
          sameSite: params.sameSite || "Lax",
          url: params.url,
          expires: params.expires,
        });
        return { success: true };
      }

      case "deleteCookies": {
        if (!params.name) {
          throw new BrowserError(
            "InvalidParams",
            "name required for deleteCookies",
          );
        }
        await deleteCookies(cdp, params.name, params.url);
        return { success: true };
      }

      case "getLocalStorage": {
        const localStorage = await getLocalStorage(cdp);
        return { localStorage };
      }

      case "setLocalStorage": {
        if (!params.key) {
          throw new BrowserError(
            "InvalidParams",
            "key required for setLocalStorage",
          );
        }
        await setLocalStorage(cdp, params.key, params.value || "");
        return { success: true };
      }

      case "clearStorage": {
        await clearStorage(cdp, params.types || ["cookies", "local_storage"]);
        return { success: true };
      }

      default: {
        throw new BrowserError(
          "InvalidAction",
          `Unknown storage action: ${(params as StorageParams).action}`,
        );
      }
    }
  } finally {
    cdp.close();
  }
}

// TypeBox schema for tool registration
import { Type } from "@sinclair/typebox";

export const BrowserStorageSchema = Type.Object({
  target: Type.Optional(Type.String({ description: "Tab ID" })),
  action: Type.Union([
    Type.Literal("getCookies"),
    Type.Literal("setCookie"),
    Type.Literal("deleteCookies"),
    Type.Literal("getLocalStorage"),
    Type.Literal("setLocalStorage"),
    Type.Literal("clearStorage"),
  ]),
  // For setCookie
  name: Type.Optional(Type.String()),
  value: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
  path: Type.Optional(Type.String({ default: "/" })),
  httpOnly: Type.Optional(Type.Boolean()),
  secure: Type.Optional(Type.Boolean()),
  sameSite: Type.Optional(
    Type.Union([
      Type.Literal("Strict"),
      Type.Literal("Lax"),
      Type.Literal("None"),
    ]),
  ),
  url: Type.Optional(Type.String()),
  // For setLocalStorage
  key: Type.Optional(Type.String()),
  // For clearStorage
  types: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("cookies"),
        Type.Literal("local_storage"),
        Type.Literal("session_storage"),
      ]),
    ),
  ),
});
