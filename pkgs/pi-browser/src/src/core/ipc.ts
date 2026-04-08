import { createConnection, Socket } from "net";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import { homedir } from "os";

// Cache directory for Unix sockets
const CACHE_DIR = `${process.env.HOME || homedir()}/.cache/pi-browser`;

/**
 * Get the socket/pipe path for a tab based on the platform.
 * Windows uses named pipes, Unix uses domain sockets.
 */
export function getSocketPath(tabId: string): string {
  if (process.platform === "win32") {
    // Windows named pipe format
    return `\\\\.\\pipe\\pi-browser-${tabId}`;
  }
  // Unix domain socket path
  return `${CACHE_DIR}/sockets/${tabId}.sock`;
}

/**
 * Get the directory path for sockets (Unix only).
 * Returns null on Windows since named pipes don't use filesystem paths.
 */
export function getSocketDir(): string | null {
  if (process.platform === "win32") {
    return null;
  }
  return `${CACHE_DIR}/sockets`;
}

/**
 * Ensure socket directory exists (Unix only).
 * No-op on Windows since named pipes don't need directory creation.
 */
export async function ensureSocketDir(): Promise<void> {
  if (process.platform === "win32") {
    return; // Windows named pipes don't use filesystem paths
  }
  const socketDir = getSocketDir()!;
  await mkdir(socketDir, { recursive: true });
}

/**
 * IPC Client for communicating with daemon processes.
 * Works with both Unix domain sockets and Windows named pipes.
 */
export class IPCClient {
  private socket: Socket | null = null;
  private buffer = "";
  private pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private id = 0;
  private eventHandlers = new Map<string, ((params: unknown) => void)[]>();

  constructor(private socketPath: string) {}

  /**
   * Connect to the IPC socket/pipe.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Node's createConnection works with both Unix sockets and Windows named pipes
      this.socket = createConnection(this.socketPath, () => {
        resolve();
      });

      this.socket.on("error", (err) => {
        reject(new Error(`IPC connection failed: ${err.message}`));
      });

      this.socket.on("data", (data) => {
        this.handleData(data.toString());
      });

      this.socket.on("close", () => {
        this.cleanup();
      });
    });
  }

  /**
   * Send a request and wait for response.
   */
  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.socket) {
      throw new Error("IPC client not connected");
    }

    const id = ++this.id;
    const request = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Send NDJSON format (newline-delimited JSON)
      this.socket!.write(JSON.stringify(request) + "\n");

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`IPC request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Subscribe to events from the daemon.
   */
  on(event: string, handler: (params: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Unsubscribe from events.
   */
  off(event: string, handler: (params: unknown) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Close the IPC connection.
   */
  close(): void {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
    this.cleanup();
  }

  private handleData(data: string): void {
    this.buffer += data;

    // Process complete NDJSON lines
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  }

  private handleMessage(message: {
    id?: number;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: { code: number; message: string };
  }): void {
    // Handle response to a request
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
      return;
    }

    // Handle event notification
    if (message.method) {
      const handlers = this.eventHandlers.get(message.method);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message.params);
          } catch (e) {
            console.error(`Error in IPC event handler for ${message.method}:`, e);
          }
        }
      }
    }
  }

  private cleanup(): void {
    // Reject all pending requests
    for (const [id, { reject }] of Array.from(this.pendingRequests.entries())) {
      reject(new Error("IPC connection closed"));
    }
    this.pendingRequests.clear();
  }
}

/**
 * Get the Node.js executable path for spawning daemons.
 * On Windows, uses process.execPath to get the full path to node.exe.
 * On Unix, uses 'node' which is assumed to be in PATH.
 */
export function getNodePath(): string {
  if (process.platform === "win32") {
    // On Windows, use the full path to the current Node executable
    return process.execPath;
  }
  // On Unix, assume node is in PATH
  return "node";
}

/**
 * Check if running on Windows.
 */
export function isWindows(): boolean {
  return process.platform === "win32";
}

/**
 * Format a socket path for display (handles escaping for Windows).
 */
export function formatSocketPath(socketPath: string): string {
  if (process.platform === "win32") {
    // Display Windows pipe path more readably
    return socketPath.replace(/\\\\/g, "\\");
  }
  return socketPath;
}
