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
export declare class MockDaemon {
    private socketPath;
    private server;
    private latency;
    private injectedError;
    private requestHandler;
    private tabs;
    private nextTabId;
    private navigationHistory;
    constructor(socketPath: string);
    start(): Promise<void>;
    stop(): Promise<void>;
    send(request: IPCRequest): Promise<IPCResponse>;
    onRequest(handler: (req: IPCRequest) => void): void;
    setLatency(ms: number): void;
    injectError(code: string, message: string): void;
    private handleRequest;
    private processCommand;
    private sendResponse;
    private delay;
}
