/**
 * Fixture Server for serving HTML test fixtures with dynamic port allocation.
 * Uses Node.js built-in http module for zero dependencies.
 */
export interface FixtureServerOptions {
    /** Port number. Use 0 or undefined for auto-assign */
    port?: number;
    /** Directory containing fixture files. Default: 'tests/fixtures' */
    fixtureDir: string;
    /** Enable CORS headers. Default: false */
    cors?: boolean;
    /** Enable request logging. Default: false */
    logRequests?: boolean;
}
export interface FixtureServer {
    /** Full server URL e.g., "http://localhost:54321" */
    url: string;
    /** Actual port number assigned */
    port: number;
    /** Stop the server */
    stop: () => Promise<void>;
    /** Reload server configuration */
    reload: () => Promise<void>;
}
/**
 * Find a free port on the system.
 * Tries port 0 (OS auto-assign) first, with fallback to manual scan.
 */
export declare function findFreePort(): Promise<number>;
/**
 * Start the fixture server.
 * Serves static files from the specified fixture directory with optional CORS support.
 */
export declare function startFixtureServer(options: FixtureServerOptions): Promise<FixtureServer>;
