export interface MockTab {
    targetId: string;
    url: string;
    title: string;
    type: "page";
    html: string;
    consoleLogs: Array<{
        level: string;
        message: string;
        timestamp: number;
    }>;
    networkRequests: Array<{
        requestId: string;
        url: string;
        method: string;
        timestamp: number;
    }>;
    attached: boolean;
    sessionId?: string;
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
export declare class MockCDPServer {
    private port;
    private httpServer;
    private wsServer;
    private clients;
    private tabs;
    private latency;
    private errorInjection;
    private nextRequestId;
    constructor(port?: number);
    start(): Promise<void>;
    stop(): Promise<void>;
    setLatency(ms: number): void;
    injectError(method: string, code: number, message: string): void;
    clearError(method: string): void;
    addTab(params: {
        url: string;
        title: string;
    }): string;
    removeTab(targetId: string): boolean;
    setPageContent(targetId: string, html: string): void;
    injectConsole(targetId: string, level: string, message: string): void;
    simulateNavigation(targetId: string, url: string): void;
    fireEvent(targetId: string, method: string, params: unknown): void;
    private handleMessage;
    private processMethod;
    getTab(targetId: string): MockTab | undefined;
    getAllTabs(): MockTab[];
    clearTabs(): void;
}
