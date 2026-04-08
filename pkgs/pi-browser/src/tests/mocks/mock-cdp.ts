import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { randomUUID } from "crypto";

export interface MockCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface MockTab {
  targetId: string;
  url: string;
  title: string;
  type: "page";
  html: string;
  consoleLogs: Array<{ level: string; message: string; timestamp: number }>;
  networkRequests: Array<{
    requestId: string;
    url: string;
    method: string;
    timestamp: number;
  }>;
  attached: boolean;
  sessionId?: string;
  deviceScaleFactor?: number;
  localStorage: Map<string, string>;
  cookies: MockCookie[];
}

export interface CDPRequest {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface CDPResponse {
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface CDPEvent {
  method: string;
  params?: unknown;
}

export class MockCDPServer {
  private port: number;
  private httpServer: ReturnType<typeof createServer> | null = null;
  private wsServer: WebSocketServer | null = null;
  private clients: Map<WebSocket, { sessionId?: string; targetId?: string }> =
    new Map();
  private tabs: Map<string, MockTab> = new Map();
  private latency: number = 0;
  private errorInjection: Map<string, { code: number; message: string }> =
    new Map();
  private nextRequestId: number = 1;

  // CDP passthrough method handlers
  private cdpResponses: Map<string, Map<string, unknown>> = new Map();
  private cdpErrors: Map<string, { code: number; message: string }> = new Map();
  private cdpLastParams: Map<string, Record<string, unknown>> = new Map();

  constructor(port: number = 9222) {
    this.port = port;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer((req, res) => {
        // Handle HTTP JSON endpoint for browser version, etc.
        if (req.url === "/json/version") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              Browser: "MockChrome/1.0.0",
              "Protocol-Version": "1.3",
              "User-Agent": "MockCDP/1.0",
              "V8-Version": "1.0.0",
              "WebKit-Version": "1.0.0",
              webSocketDebuggerUrl: `ws://localhost:${this.port}/devtools/browser`,
            }),
          );
          return;
        }

        // Handle /json/list endpoint
        if (req.url === "/json/list" || req.url === "/json") {
          res.writeHead(200, { "Content-Type": "application/json" });
          const targets = Array.from(this.tabs.values()).map((tab) => ({
            id: tab.targetId,
            title: tab.title,
            type: tab.type,
            url: tab.url,
            webSocketDebuggerUrl: `ws://localhost:${this.port}/devtools/page/${tab.targetId}`,
            devtoolsFrontendUrl: `/devtools/inspector.html?ws=localhost:${this.port}/devtools/page/${tab.targetId}`,
          }));
          res.end(JSON.stringify(targets));
          return;
        }

        res.writeHead(404);
        res.end("Not Found");
      });

      this.wsServer = new WebSocketServer({
        server: this.httpServer,
        path: "/devtools/browser",
      });

      this.wsServer.on("connection", (ws, req) => {
        const clientInfo: { sessionId?: string; targetId?: string } = {};
        this.clients.set(ws, clientInfo);

        ws.on("message", (data) => {
          try {
            const message = JSON.parse(data.toString()) as CDPRequest;
            this.handleMessage(ws, message, clientInfo);
          } catch (err) {
            ws.send(
              JSON.stringify({
                error: {
                  code: -32700,
                  message: "Parse error",
                },
              }),
            );
          }
        });

        ws.on("close", () => {
          this.clients.delete(ws);
        });
      });

      this.httpServer.listen(this.port, () => {
        resolve();
      });

      this.httpServer.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all WebSocket connections
      for (const [ws] of this.clients) {
        ws.close();
      }
      this.clients.clear();

      // Close WebSocket server
      this.wsServer?.close(() => {
        // Close HTTP server
        this.httpServer?.close(() => {
          resolve();
        });
      });
    });
  }

  setLatency(ms: number): void {
    this.latency = ms;
  }

  injectError(method: string, code: number, message: string): void {
    this.errorInjection.set(method, { code, message });
  }

  clearError(method: string): void {
    this.errorInjection.delete(method);
  }

  addTab(params: { url: string; title: string }): string {
    const targetId = randomUUID().slice(0, 8);
    const tab: MockTab = {
      targetId,
      url: params.url,
      title: params.title,
      type: "page",
      html: "",
      consoleLogs: [],
      networkRequests: [],
      attached: false,
      localStorage: new Map(),
      cookies: [],
    };
    this.tabs.set(targetId, tab);
    return targetId;
  }

  removeTab(targetId: string): boolean {
    return this.tabs.delete(targetId);
  }

  setPageContent(targetId: string, html: string): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      tab.html = html;
    }
  }

  injectConsole(targetId: string, level: string, message: string): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      tab.consoleLogs.push({
        level,
        message,
        timestamp: Date.now(),
      });
      this.fireEvent(targetId, "Runtime.consoleAPICalled", {
        type: level,
        args: [{ value: message }],
        timestamp: Date.now(),
        executionContextId: 1,
      });
    }
  }

  simulateConsoleAPICalled(
    targetId: string,
    params: {
      type: string;
      args: Array<{ value: string }>;
      timestamp: number;
      executionContextId?: number;
    }
  ): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      const message = params.args.map((a) => a.value).join(" ");
      tab.consoleLogs.push({
        level: params.type,
        message,
        timestamp: params.timestamp,
      });
      this.fireEvent(targetId, "Runtime.consoleAPICalled", {
        type: params.type,
        args: params.args,
        timestamp: params.timestamp,
        executionContextId: params.executionContextId ?? 1,
      });
    }
  }

  simulateNavigation(targetId: string, url: string): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      tab.url = url;
      tab.title = `Page: ${url}`;

      // Fire navigation events
      this.fireEvent(targetId, "Network.requestWillBeSent", {
        requestId: String(this.nextRequestId++),
        loaderId: randomUUID().slice(0, 8),
        documentURL: url,
        request: {
          url,
          method: "GET",
          headers: {},
          mixedContentType: "none",
          initialPriority: "VeryHigh",
        },
        timestamp: Date.now() / 1000,
        wallTime: Date.now() / 1000,
        initiator: { type: "other" },
        type: "Document",
      });

      this.fireEvent(targetId, "Network.responseReceived", {
        requestId: String(this.nextRequestId - 1),
        loaderId: randomUUID().slice(0, 8),
        timestamp: Date.now() / 1000,
        type: "Document",
        response: {
          url,
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "text/html" },
          mimeType: "text/html",
        },
      });

      // Simulate delay then fire load event
      setTimeout(() => {
        this.fireEvent(targetId, "Page.loadEventFired", {
          timestamp: Date.now() / 1000,
        });
      }, 100);
    }
  }

  fireEvent(targetId: string, method: string, params: unknown): void {
    for (const [ws, clientInfo] of this.clients) {
      if (clientInfo.targetId === targetId) {
        ws.send(JSON.stringify({ method, params }));
      }
    }
  }

  private async handleMessage(
    ws: WebSocket,
    message: CDPRequest,
    clientInfo: { sessionId?: string; targetId?: string },
  ): Promise<void> {
    // Apply latency simulation
    if (this.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latency));
    }

    // Check for injected errors
    const injectedError = this.errorInjection.get(message.method);
    if (injectedError) {
      const response: CDPResponse = {
        id: message.id,
        error: {
          code: injectedError.code,
          message: injectedError.message,
        },
      };
      ws.send(JSON.stringify(response));
      return;
    }

    // Handle CDP methods
    const response = this.processMethod(message, clientInfo);
    ws.send(JSON.stringify(response));
  }

  private processMethod(
    message: CDPRequest,
    clientInfo: { sessionId?: string; targetId?: string },
  ): CDPResponse {
    const { id, method, params = {} } = message;
    const targetId = clientInfo.targetId || "";

    // Store last params for CDP passthrough testing
    if (targetId) {
      this.cdpLastParams.set(`${targetId}:${method}`, params as Record<string, unknown>);
    }

    // Check for custom CDP response (for passthrough testing)
    if (targetId) {
      const customResponses = this.cdpResponses.get(targetId);
      if (customResponses?.has(method)) {
        return { id, result: customResponses.get(method) };
      }
    }

    // Check for custom CDP error (for passthrough testing)
    if (targetId) {
      const customError = this.cdpErrors.get(`${targetId}:${method}`);
      if (customError) {
        return { id, error: { code: customError.code, message: customError.message } };
      }
    }

    switch (method) {
      case "Target.getTargets": {
        // Find which tab is currently active
        let activeTabId: string | null = null;
        for (const [tid, tab] of this.tabs) {
          if ((tab as MockTab & { active?: boolean }).active) {
            activeTabId = tid;
            break;
          }
        }
        // If no active tab set and we have tabs, mark the first as active
        if (!activeTabId && this.tabs.size > 0) {
          const firstTab = this.tabs.values().next().value as MockTab;
          activeTabId = firstTab.targetId;
          (firstTab as MockTab & { active?: boolean }).active = true;
        }

        const targetInfos = Array.from(this.tabs.values()).map((tab) => ({
          targetId: tab.targetId,
          type: tab.type,
          title: tab.title,
          url: tab.url,
          attached: tab.attached,
          active: (tab as MockTab & { active?: boolean }).active || false,
        }));
        return { id, result: { targetInfos } };
      }

      case "Target.attachToTarget": {
        const { targetId, flatten = true } = params as {
          targetId?: string;
          flatten?: boolean;
        };
        if (!targetId || !this.tabs.has(targetId)) {
          return {
            id,
            error: {
              code: -32000,
              message: `Target ${targetId} not found`,
            },
          };
        }
        const sessionId = randomUUID().slice(0, 16);
        clientInfo.sessionId = sessionId;
        clientInfo.targetId = targetId;
        const tab = this.tabs.get(targetId);
        if (tab) {
          tab.attached = true;
          tab.sessionId = sessionId;
        }
        return { id, result: { sessionId } };
      }

      case "Target.detachFromTarget": {
        const { sessionId } = params as { sessionId?: string };
        if (sessionId && clientInfo.sessionId === sessionId) {
          const tab = this.tabs.get(clientInfo.targetId || "");
          if (tab) {
            tab.attached = false;
          }
          clientInfo.sessionId = undefined;
          clientInfo.targetId = undefined;
        }
        return { id, result: {} };
      }

      case "Target.createTarget": {
        const { url = "about:blank" } = params as { url?: string };
        const newTargetId = this.addTab({ url, title: "New Tab" });
        return { id, result: { targetId: newTargetId } };
      }

      case "Target.activateTarget": {
        const { targetId } = params as { targetId?: string };
        if (!targetId || !this.tabs.has(targetId)) {
          return {
            id,
            error: {
              code: -32000,
              message: `Target ${targetId} not found`,
            },
          };
        }
        // Set this tab as active, others as inactive
        for (const [id, tab] of this.tabs) {
          (tab as MockTab & { active?: boolean }).active = (id === targetId);
        }
        return { id, result: {} };
      }

      case "Target.closeTarget": {
        const { targetId } = params as { targetId?: string };
        if (!targetId || !this.tabs.has(targetId)) {
          return {
            id,
            error: {
              code: -32000,
              message: `Target ${targetId} not found`,
            },
          };
        }
        this.removeTab(targetId);
        return { id, result: { success: true } };
      }

      case "Page.enable":
        return { id, result: {} };

      case "Page.navigate": {
        const { url } = params as { url?: string };
        if (!url) {
          return {
            id,
            error: {
              code: -32000,
              message: "URL is required",
            },
          };
        }
        const targetId = clientInfo.targetId;
        if (!targetId) {
          return {
            id,
            error: {
              code: -32000,
              message: "Not attached to a target",
            },
          };
        }
        this.simulateNavigation(targetId, url);
        return {
          id,
          result: {
            frameId: targetId,
            loaderId: randomUUID().slice(0, 8),
          },
        };
      }

      case "Page.reload": {
        const targetId = clientInfo.targetId;
        if (targetId) {
          const tab = this.tabs.get(targetId);
          if (tab) {
            this.simulateNavigation(targetId, tab.url);
          }
        }
        return { id, result: {} };
      }

      case "Page.captureScreenshot": {
        // Return a deterministic 1x1 red PNG (base64)
        const mockPng =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        return { id, result: { data: mockPng } };
      }

      case "Accessibility.enable":
        return { id, result: {} };

      case "Accessibility.getFullAXTree": {
        // Return a mock accessibility tree with interactive elements
        const targetId = clientInfo.targetId;
        const tab = targetId ? this.tabs.get(targetId) : undefined;
        return {
          id,
          result: {
            nodes: [
              {
                nodeId: 1,
                backendDOMNodeId: 101,
                ignored: false,
                role: { value: "RootWebArea" },
                name: { value: tab?.title || "" },
                childIds: [2, 3, 4, 5],
              },
              {
                nodeId: 2,
                backendDOMNodeId: 102,
                ignored: false,
                role: { value: "button" },
                name: { value: "Submit" },
              },
              {
                nodeId: 3,
                backendDOMNodeId: 103,
                ignored: false,
                role: { value: "link" },
                name: { value: "About us" },
                properties: [{ name: "href", value: { value: "/about" } }],
              },
              {
                nodeId: 4,
                backendDOMNodeId: 104,
                ignored: false,
                role: { value: "textbox" },
                name: { value: "Email" },
                properties: [{ name: "placeholder", value: { value: "Enter email" } }],
              },
              {
                nodeId: 5,
                backendDOMNodeId: 105,
                ignored: false,
                role: { value: "checkbox" },
                name: { value: "Remember me" },
              },
            ],
          },
        };
      }

      case "Runtime.enable":
        return { id, result: {} };

      case "Runtime.disable":
        return { id, result: {} };

      case "Log.enable":
        return { id, result: {} };

      case "Log.disable":
        return { id, result: {} };

      case "Runtime.evaluate": {
        const { expression } = params as { expression?: string };
        if (!expression) {
          return {
            id,
            error: {
              code: -32000,
              message: "Expression is required",
            },
          };
        }

        // Simple expression evaluation simulation
        let result: unknown;
        let exceptionDetails;

        try {
          // Handle common expressions
          if (expression.includes("document.title")) {
            const targetId = clientInfo.targetId;
            const tab = targetId ? this.tabs.get(targetId) : undefined;
            result = { value: tab?.title || "" };
          } else if (expression.includes("document.location.href")) {
            const targetId = clientInfo.targetId;
            const tab = targetId ? this.tabs.get(targetId) : undefined;
            result = { value: tab?.url || "" };
          } else if (expression.includes("document.documentElement.outerHTML")) {
            const targetId = clientInfo.targetId;
            const tab = targetId ? this.tabs.get(targetId) : undefined;
            result = { value: tab?.html || "" };
          } else if (expression.startsWith("1 + 1")) {
            result = { value: 2 };
          } else if (expression === "JSON.stringify(localStorage)" || expression === "JSON.stringify(sessionStorage)") {
            // Return localStorage or sessionStorage data from mock
            const targetId = clientInfo.targetId;
            const tab = targetId ? this.tabs.get(targetId) : undefined;
            const storageType = expression.includes("localStorage") ? "localStorage" : "sessionStorage";
            if (storageType === "localStorage" && tab) {
              result = { value: JSON.stringify(Object.fromEntries(tab.localStorage.entries())) };
            } else {
              result = { value: "{}" };
            }
          } else if (expression.startsWith("localStorage.setItem")) {
            // Parse localStorage.setItem(key, value)
            const targetId = clientInfo.targetId;
            const tab = targetId ? this.tabs.get(targetId) : undefined;
            if (tab) {
              // Match localStorage.setItem(key, value) where key is a JSON string and value is any JSON value
              // The comma separating args is followed by space, while commas inside JSON are not
              const match = expression.match(/localStorage\.setItem\(("(?:[^"\\]|\\.)*"),\s*(.+)\)$/);
              if (match) {
                try {
                  // Parse the key (always a JSON string) and value (any JSON)
                  const key = JSON.parse(match[1]);
                  // For value, use the rest of the expression up to the closing paren
                  const valueExpr = match[2];
                  const value = new Function("return " + valueExpr)();
                  tab.localStorage.set(key, value);
                } catch {
                  // Fallback: simple string parsing for the value
                  const key = match[1].replace(/^"|"$/g, "");
                  const value = match[2].replace(/^"|"$/g, "");
                  tab.localStorage.set(key, value);
                }
              }
            }
            result = { value: undefined };
          } else if (expression.startsWith("localStorage.removeItem")) {
            // Parse localStorage.removeItem(key)
            const targetId = clientInfo.targetId;
            const tab = targetId ? this.tabs.get(targetId) : undefined;
            if (tab) {
              const match = expression.match(/localStorage\.removeItem\((.+)\)/);
              if (match) {
                try {
                  const key = new Function("return " + match[1])();
                  tab.localStorage.delete(key);
                } catch {
                  const key = match[1].replace(/^"|"$/g, "");
                  tab.localStorage.delete(key);
                }
              }
            }
            result = { value: undefined };
          } else if (expression === "1 + 1") {
            result = { value: 2 };
          } else if (expression.startsWith("JSON.stringify")) {
            result = { value: "{}" };
          } else {
            result = { value: null };
          }
        } catch (err) {
          exceptionDetails = {
            text: String(err),
            lineNumber: 0,
            columnNumber: 0,
          };
        }

        if (exceptionDetails) {
          return {
            id,
            result: {
              result: { type: "undefined" },
              exceptionDetails,
            },
          };
        }

        return {
          id,
          result: {
            result: {
              type: typeof result === "object" ? "object" : typeof result,
              value: (result as { value: unknown })?.value ?? result,
            },
          },
        };
      }

      case "Network.enable":
        return { id, result: {} };

      case "Network.disable":
        return { id, result: {} };

      case "Network.setRequestInterception":
        return { id, result: {} };

      case "Network.setCacheDisabled":
        return { id, result: {} };

      case "Storage.clearDataForOrigin": {
        const { storageTypes } = params as { storageTypes?: string };
        const targetId = clientInfo.targetId;
        const tab = targetId ? this.tabs.get(targetId) : undefined;
        if (tab && storageTypes) {
          const types = storageTypes.split(",");
          if (types.includes("local_storage")) {
            tab.localStorage.clear();
          }
          if (types.includes("cookies") || types.includes("local_storage")) {
            tab.cookies = [];
          }
        }
        return { id, result: {} };
      }

      case "Network.getCookies": {
        const { urls } = params as { urls?: string[] };
        const targetId = clientInfo.targetId;
        const tab = targetId ? this.tabs.get(targetId) : undefined;
        let cookies = tab?.cookies || [];
        // Filter by URL if specified
        if (urls && urls.length > 0) {
          const url = new URL(urls[0]);
          cookies = cookies.filter(c => {
            const cookieDomain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
            return url.hostname === cookieDomain || url.hostname.endsWith(c.domain);
          });
        }
        return { id, result: { cookies } };
      }

      case "Network.setCookie": {
        const { name, value, domain, path, httpOnly, secure, sameSite, expires } = params as MockCookie;
        const targetId = clientInfo.targetId;
        const tab = targetId ? this.tabs.get(targetId) : undefined;
        if (tab) {
          // Update existing or add new
          const existingIndex = tab.cookies.findIndex(c => c.name === name && c.domain === (domain || ""));
          const newCookie: MockCookie = { name, value, domain: domain || "", path: path || "/", httpOnly: httpOnly || false, secure: secure || false, sameSite, expires };
          if (existingIndex >= 0) {
            tab.cookies[existingIndex] = newCookie;
          } else {
            tab.cookies.push(newCookie);
          }
        }
        return { id, result: { success: true } };
      }

      case "Network.deleteCookies": {
        const { name, url } = params as { name: string; url?: string };
        const targetId = clientInfo.targetId;
        const tab = targetId ? this.tabs.get(targetId) : undefined;
        if (tab) {
          if (url) {
            // Delete specific cookie by name and URL
            tab.cookies = tab.cookies.filter(c => !(c.name === name));
          } else {
            // Delete all cookies with matching name
            tab.cookies = tab.cookies.filter(c => c.name !== name);
          }
        }
        return { id, result: {} };
      }

      case "DOM.enable":
        return { id, result: {} };

      case "DOM.getDocument": {
        const targetId = clientInfo.targetId;
        const tab = targetId ? this.tabs.get(targetId) : undefined;
        return {
          id,
          result: {
            root: {
              nodeId: 1,
              backendNodeId: 1,
              nodeType: 9,
              nodeName: "#document",
              localName: "",
              nodeValue: "",
              childNodeCount: tab?.html ? 1 : 0,
              children: [],
            },
          },
        };
      }

      case "DOM.querySelector": {
        const { selector } = params as { selector?: string };
        return {
          id,
          result: {
            nodeId: selector ? 2 : 0,
          },
        };
      }

      case "Input.dispatchMouseEvent":
        return { id, result: {} };

      case "Input.dispatchKeyEvent":
        return { id, result: {} };

      case "Emulation.getDeviceMetricsOverride": {
        const targetId = clientInfo.targetId;
        const tab = targetId ? this.tabs.get(targetId) : undefined;
        return {
          id,
          result: {
            deviceScaleFactor: tab?.deviceScaleFactor ?? 1,
          },
        };
      }

      case "Page.getLayoutMetrics": {
        const targetId = clientInfo.targetId;
        const tab = targetId ? this.tabs.get(targetId) : undefined;
        const dpr = tab?.deviceScaleFactor ?? 1;
        const cssWidth = 1024;
        const cssHeight = 768;
        return {
          id,
          result: {
            visualViewport: {
              clientWidth: Math.round(cssWidth * dpr),
              clientHeight: Math.round(cssHeight * dpr),
              scale: dpr,
            },
            cssVisualViewport: {
              clientWidth,
              clientHeight,
            },
          },
        };
      }

      default:
        return {
          id,
          error: {
            code: -32601,
            message: `Method '${method}' not implemented in mock`,
          },
        };
    }
  }

  // Helper methods for test verification
  getTab(targetId: string): MockTab | undefined {
    return this.tabs.get(targetId);
  }

  getAllTabs(): MockTab[] {
    return Array.from(this.tabs.values());
  }

  clearTabs(): void {
    this.tabs.clear();
  }

  setDevicePixelRatio(targetId: string, dpr: number): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      tab.deviceScaleFactor = dpr;
    }
  }

  // LocalStorage helpers for testing
  setLocalStorage(targetId: string, data: Record<string, string>): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      for (const [key, value] of Object.entries(data)) {
        tab.localStorage.set(key, value);
      }
    }
  }

  clearLocalStorage(targetId: string): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      tab.localStorage.clear();
    }
  }

  getLocalStorage(targetId: string): Record<string, string> {
    const tab = this.tabs.get(targetId);
    if (!tab) return {};
    return Object.fromEntries(tab.localStorage.entries());
  }

  // Cookie helpers for testing
  setCookies(targetId: string, cookies: MockCookie[]): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      tab.cookies = [...cookies];
    }
  }

  clearCookies(targetId: string): void {
    const tab = this.tabs.get(targetId);
    if (tab) {
      tab.cookies = [];
    }
  }

  getCookies(targetId: string): MockCookie[] {
    const tab = this.tabs.get(targetId);
    return tab?.cookies || [];
  }

  // CDP passthrough helper methods
  setCDPResponse(targetId: string, method: string, response: unknown): void {
    if (!this.cdpResponses.has(targetId)) {
      this.cdpResponses.set(targetId, new Map());
    }
    this.cdpResponses.get(targetId)!.set(method, response);
  }

  setCDPError(targetId: string, method: string, message: string, code: number): void {
    this.cdpErrors.set(`${targetId}:${method}`, { code, message });
  }

  getLastCDPParams(targetId: string, method: string): Record<string, unknown> | undefined {
    return this.cdpLastParams.get(`${targetId}:${method}`);
  }

  clearCDPResponses(targetId?: string): void {
    if (targetId) {
      this.cdpResponses.delete(targetId);
    } else {
      this.cdpResponses.clear();
    }
    this.cdpErrors.clear();
    this.cdpLastParams.clear();
  }
}
