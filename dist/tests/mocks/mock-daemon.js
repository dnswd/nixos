import * as net from 'net';
import * as fs from 'fs';
export class MockDaemon {
    socketPath;
    server = null;
    latency = 0;
    injectedError = null;
    requestHandler = null;
    // State tracking
    tabs = new Map();
    nextTabId = 1;
    navigationHistory = [];
    constructor(socketPath) {
        this.socketPath = socketPath;
    }
    async start() {
        return new Promise((resolve, reject) => {
            // Clean up existing socket file if it exists
            if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
                try {
                    fs.unlinkSync(this.socketPath);
                }
                catch {
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
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    // Clean up socket file
                    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
                        try {
                            fs.unlinkSync(this.socketPath);
                        }
                        catch {
                            // Ignore errors
                        }
                    }
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    async send(request) {
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
                            const response = JSON.parse(line.trim());
                            if (response.id === request.id) {
                                client.end();
                                resolve(response);
                                return;
                            }
                        }
                        catch {
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
    onRequest(handler) {
        this.requestHandler = handler;
    }
    setLatency(ms) {
        this.latency = ms;
    }
    injectError(code, message) {
        this.injectedError = { code, message };
    }
    async handleRequest(line, socket) {
        try {
            const request = JSON.parse(line);
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
        }
        catch (err) {
            this.sendResponse(socket, {
                id: 0,
                ok: false,
                error: `ParseError: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        }
    }
    processCommand(request) {
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
                const tab = {
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
    sendResponse(socket, response) {
        socket.write(JSON.stringify(response) + '\n');
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
