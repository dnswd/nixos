import { WebSocket } from "ws";

export interface CDPClient {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (params: unknown) => void): void;
  off(event: string, handler: (params: unknown) => void): void;
  close(): void;
}

export type CDPEventHandler = (params: unknown) => void;

interface CDPRequest {
  id: number;
  method: string;
  params?: Record<string, unknown>;
  sessionId?: string;
}

interface CDPResponse {
  id?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  method?: string;
  params?: unknown;
}

class CDPClientImpl implements CDPClient {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private eventHandlers = new Map<string, CDPEventHandler[]>();

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on("message", (data) => {
      const message = JSON.parse(data.toString()) as CDPResponse;
      
      // Handle command responses
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
        return;
      }
      
      // Handle events (messages without id but with method)
      if (message.method) {
        const handlers = this.eventHandlers.get(message.method);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(message.params);
            } catch (e) {
              console.error(`Error in event handler for ${message.method}:`, e);
            }
          }
        }
      }
    });
  }

  on(event: string, handler: CDPEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: CDPEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const request: CDPRequest = { id, method, params };
      this.ws.send(JSON.stringify(request));

      // Timeout after 15 seconds
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 15000);
    });
  }

  close(): void {
    this.eventHandlers.clear();
    this.ws.close();
  }
}

export async function connectCDP(url: string): Promise<CDPClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on("open", () => {
      resolve(new CDPClientImpl(ws));
    });
    ws.on("error", (err) => {
      reject(new Error(`WebSocket error: ${err.message}`));
    });
  });
}

// Persistent connections for event listening
const persistentConnections = new Map<string, CDPClient>();

// Mock client registry for testing
const mockClients = new Map<string, CDPClient>();

/**
 * Register a mock CDP client for testing.
 * This overrides the real WebSocket connection for the given target ID.
 */
export function registerCDPClient(targetId: string, client: CDPClient): void {
  mockClients.set(targetId, client);
}

/**
 * Unregister a mock CDP client.
 * Cleans up the mock and allows real connections for the target ID.
 */
export function unregisterCDPClient(targetId: string): void {
  const client = mockClients.get(targetId);
  if (client) {
    mockClients.delete(targetId);
    try {
      client.close();
    } catch {
      // Ignore close errors during cleanup
    }
  }
  // Also clean up persistent connection if any
  if (persistentConnections.has(targetId)) {
    const persistentClient = persistentConnections.get(targetId);
    persistentConnections.delete(targetId);
    try {
      persistentClient?.close();
    } catch {
      // Ignore close errors during cleanup
    }
  }
}

export async function getCDPClient(targetId: string, persistent = false): Promise<CDPClient> {
  // Check for mock client first (for testing)
  const mockClient = mockClients.get(targetId);
  if (mockClient) {
    return mockClient;
  }

  // Reuse existing persistent connection if available
  if (persistent && persistentConnections.has(targetId)) {
    return persistentConnections.get(targetId)!;
  }

  // Connect to the browser's DevTools protocol
  const browserWsUrl = await getBrowserWsUrl();
  const cdp = await connectCDP(browserWsUrl);

  // Attach to the target
  const result = (await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  })) as { sessionId?: string };

  if (!result.sessionId) {
    cdp.close();
    throw new Error(`Failed to attach to target ${targetId}`);
  }

  // Store persistent connection if requested
  if (persistent) {
    persistentConnections.set(targetId, cdp);
    
    // Clean up on close
    const originalClose = cdp.close.bind(cdp);
    cdp.close = () => {
      persistentConnections.delete(targetId);
      originalClose();
    };
  }

  return cdp;
}

export function closePersistentConnection(targetId: string): void {
  const cdp = persistentConnections.get(targetId);
  if (cdp) {
    persistentConnections.delete(targetId);
    cdp.close();
  }
}

export function hasPersistentConnection(targetId: string): boolean {
  return persistentConnections.has(targetId);
}

async function getBrowserWsUrl(): Promise<string> {
  const home = process.env.HOME || "/tmp";

  // Try common Chrome DevTools ActivePort locations
  const candidates = [
    process.env.CDP_WS_URL,
    // macOS
    `${home}/Library/Application Support/Google/Chrome/Default/DevToolsActivePort`,
    `${home}/Library/Application Support/Chromium/Default/DevToolsActivePort`,
    // Linux
    `${home}/.config/google-chrome/Default/DevToolsActivePort`,
    `${home}/.config/chromium/Default/DevToolsActivePort`,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (candidate.startsWith("ws://") || candidate.startsWith("wss://")) {
      return candidate;
    }

    try {
      const fs = await import("fs");
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, "utf8").trim();
        const lines = content.split("\n");
        if (lines.length >= 2) {
          const port = lines[0];
          const path = lines[1];
          return `ws://127.0.0.1:${port}${path}`;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error(
    "No DevToolsActivePort found. Enable remote debugging at chrome://inspect/#remote-debugging",
  );
}
