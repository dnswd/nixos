import { WebSocket } from "ws";
import { acquireMutex, releaseMutex } from "./mutex.js";
import { getBrowserWsUrl } from "./browser-discovery.js";

export interface CDPClient {
  send(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<unknown>;
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

  send(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<unknown> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const request: CDPRequest = { id, method, params };
      if (sessionId) {
        request.sessionId = sessionId;
      }
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
  // Acquire mutex before getting client (operations will auto-release)
  await acquireMutex(targetId, { timeout: 30000, operation: "cdp_operation" });

  try {
    const client = await getCDPClientInternal(targetId, persistent);
    // Wrap the client to release mutex after each send operation
    return wrapClientWithMutexRelease(client, targetId);
  } catch (error) {
    // Release mutex on error
    await releaseMutex(targetId);
    throw error;
  }
}

async function getCDPClientInternal(targetId: string, persistent = false): Promise<CDPClient> {
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

  const sessionId = result.sessionId;

  // Create a wrapper client that includes sessionId in all commands
  const sessionClient: CDPClient = {
    send: (method: string, params?: Record<string, unknown>, _sessionId?: string) => {
      // sessionId is captured from closure; _sessionId param ignored for type compatibility
      return cdp.send(method, params, sessionId);
    },
    on: (event: string, handler: (params: unknown) => void) => {
      cdp.on(event, handler);
    },
    off: (event: string, handler: (params: unknown) => void) => {
      cdp.off(event, handler);
    },
    close: () => {
      cdp.close();
    },
  };

  // Store persistent connection if requested
  if (persistent) {
    persistentConnections.set(targetId, sessionClient);
    
    // Clean up on close
    const originalClose = sessionClient.close.bind(sessionClient);
    sessionClient.close = () => {
      persistentConnections.delete(targetId);
      originalClose();
    };
  }

  return sessionClient;
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



/**
 * Wrap a CDP client to auto-release mutex after operations.
 * This ensures that the mutex is released after each CDP operation,
 * allowing other operations to proceed.
 */
function wrapClientWithMutexRelease(
  client: CDPClient,
  targetId: string
): CDPClient {
  return {
    async send(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<unknown> {
      try {
        return await client.send(method, params, sessionId);
      } finally {
        // Always release mutex after operation completes (success or failure)
        await releaseMutex(targetId);
      }
    },
    on(event: string, handler: (params: unknown) => void): void {
      client.on(event, handler);
    },
    off(event: string, handler: (params: unknown) => void): void {
      client.off(event, handler);
    },
    close(): void {
      // Release mutex before closing connection
      releaseMutex(targetId).finally(() => {
        client.close();
      });
    },
  };
}
