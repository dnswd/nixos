export interface ChromeInstance {
    pid: number;
    port: number;
    kill(): Promise<void>;
    isRunning(): boolean;
}
interface ChromeLocation {
    executable: string;
    type: 'chrome' | 'chromium' | 'edge';
}
declare function findChrome(): ChromeLocation | null;
declare function createTempUserDataDir(): string;
export declare function launchChrome(options?: {
    headless?: boolean;
    port?: number;
    userDataDir?: string;
}): Promise<ChromeInstance>;
export { findChrome, createTempUserDataDir };
