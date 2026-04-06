import * as net from 'net';
import * as fs from 'fs';
import { promisify } from 'util';

export interface IPCRequest {
  id: number;
  cmd: string;
  args: unknown[];
}

export interface IPCResponse {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface Tab {
  id: string;
  url: string;
  title: string;
  status: 'idle' | 'loading' | 'busy';
  consoleLogs: string[];
}

interface InjectedError {
  code: string;
  message: string;
}

export class MockDaemon {
  private socketPath: string;
  private server: net.Server | null = null;
  private latency = 0;
  private injectedError: InjectedError | null = null;
  private requestHandler: ((req: IPCRequest) => void) | null = null;

  // State tracking
  private tabs = new Map<string, Tab>();
  private nextTabId = 1;
  private navigationHistory: string[] = [];

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up existing socket file if it exists
      if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
        try {
          fs.unlinkSync(this.socketPath);
        } catch {
          // Ignore errors
        }
      }

      this.server = net.createServer((socket) => {
        let buffer = '';

        socket.on('data', (data) => {
          buffer += data.toString();
          let lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              this.handleRequest(line.trim(), socket);
            }
          }
        });

        socket.on('error', (err) => {
          console.error('Socket error:', err.message);
        });
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          // Clean up socket file
          if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
            try {
              fs.unlinkSync(this.socketPath);
            } catch {
              // Ignore errors
            }
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async send(request: IPCRequest): Promise<IPCResponse> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(this.socketPath, () => {
        client.write(JSON.stringify(request) + '\n');
      });

      let buffer = '';
      client.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response: IPCResponse = JSON.parse(line.trim());
              if (response.id === request.id) {
                client.end();
                resolve(response);
                return;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      });

      client.on('error', (err) => {
        reject(err);
      });
    });
  }

  onRequest(handler: (req: IPCRequest) => void): void {
    this.requestHandler = handler;
  }

  setLatency(ms: number): void {
    this.latency = ms;
  }

  injectError(code: string, message: string): void {
    this.injectedError = { code, message };
  }

  private async handleRequest(line: string, socket: net.Socket): Promise<void> {
    try {
      const request: IPCRequest = JSON.parse(line);

      if (this.requestHandler) {
        this.requestHandler(request);
      }

      // Simulate latency
      if (this.latency > 0) {
        await this.delay(this.latency);
      }

      // Check for injected error
      if (this.injectedError) {
        const error = this.injectedError;
        this.injectedError = null;
        this.sendResponse(socket, {
          id: request.id,
          ok: false,
          error: `${error.code}: ${error.message}`,
        });
        return;
      }

      const response = this.processCommand(request);
      this.sendResponse(socket, response);
    } catch (err) {
      this.sendResponse(socket, {
        id: 0,
        ok: false,
        error: `ParseError: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  }

  private processCommand(request: IPCRequest): IPCResponse {
    const { id, cmd, args } = request;

    switch (cmd) {
      case 'list':
        return {
          id,
          ok: true,
          result: Array.from(this.tabs.values()).map((t) => ({
            id: t.id,
            url: t.url,
            title: t.title,
            status: t.status,
          })),
        };

      case 'snap': {
        const tabId = String(args[0] || '');
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        return {
          id,
          ok: true,
          result: {
            url: tab.url,
            title: tab.title,
            tree: { role: 'root', children: [] },
          },
        };
      }

      case 'eval': {
        const tabId = String(args[0] || '');
        const code = String(args[1] || '');
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        if (tab.status === 'busy') {
          return { id, ok: false, error: `TabBusy: Tab ${tabId} is busy` };
        }
        // Mock evaluation result
        return {
          id,
          ok: true,
          result: { result: { value: `eval(${code})` } },
        };
      }

      case 'shot': {
        const tabId = String(args[0] || '');
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        return {
          id,
          ok: true,
          result: { data: `mock-screenshot-${tabId}` },
        };
      }

      case 'nav': {
        const url = String(args[0] || 'about:blank');
        const tabId = String(this.nextTabId++);
        const tab: Tab = {
          id: tabId,
          url,
          title: `Page at ${url}`,
          status: 'idle',
          consoleLogs: [],
        };
        this.tabs.set(tabId, tab);
        this.navigationHistory.push(url);
        return { id, ok: true, result: { tabId } };
      }

      case 'net': {
        const tabId = String(args[0] || '');
        const enable = Boolean(args[1] ?? true);
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        return {
          id,
          ok: true,
          result: { enabled: enable, tabId },
        };
      }

      case 'click': {
        const tabId = String(args[0] || '');
        const nodeId = String(args[1] || '');
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        return {
          id,
          ok: true,
          result: { clicked: nodeId },
        };
      }

      case 'clickxy': {
        const tabId = String(args[0] || '');
        const x = Number(args[1] || 0);
        const y = Number(args[2] || 0);
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        return {
          id,
          ok: true,
          result: { clickedAt: { x, y } },
        };
      }

      case 'type': {
        const tabId = String(args[0] || '');
        const nodeId = String(args[1] || '');
        const text = String(args[2] || '');
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        return {
          id,
          ok: true,
          result: { typed: text, nodeId },
        };
      }

      case 'loadall': {
        const tabId = String(args[0] || '');
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        tab.status = 'loading';
        setTimeout(() => {
          tab.status = 'idle';
        }, 100);
        return {
          id,
          ok: true,
          result: { loaded: true },
        };
      }

      case 'evalraw': {
        const tabId = String(args[0] || '');
        const code = String(args[1] || '');
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        return {
          id,
          ok: true,
          result: { executed: code },
        };
      }

      case 'stop': {
        const tabId = String(args[0] || '');
        const tab = this.tabs.get(tabId);
        if (!tab) {
          return { id, ok: false, error: `TabNotFound: Tab ${tabId} not found` };
        }
        this.tabs.delete(tabId);
        return { id, ok: true, result: { stopped: tabId } };
      }

      default:
        return { id, ok: false, error: `UnknownCommand: ${cmd}` };
    }
  }

  private sendResponse(socket: net.Socket, response: IPCResponse): void {
    socket.write(JSON.stringify(response) + '\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
