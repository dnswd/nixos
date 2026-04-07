"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchChrome = launchChrome;
exports.findChrome = findChrome;
exports.createTempUserDataDir = createTempUserDataDir;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const CHROME_PATHS = {
    darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Users/*/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Users/*/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
        '/usr/bin/microsoft-edge-stable',
        '/snap/bin/chromium',
        '/snap/bin/google-chrome',
    ],
    win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
};
function findChrome() {
    const platform = os.platform();
    const paths = CHROME_PATHS[platform] || [];
    // Try direct paths first
    for (const chromePath of paths) {
        if (chromePath.includes('*')) {
            // Handle glob patterns for user directories on macOS
            if (platform === 'darwin' && chromePath.startsWith('/Users/*/')) {
                const basePattern = chromePath.replace('/Users/*/', '/Users/');
                try {
                    const usersDir = '/Users';
                    const entries = fs.readdirSync(usersDir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory() && !entry.name.startsWith('.')) {
                            const userPath = path.join('/Users', entry.name, basePattern.replace('/Users/', ''));
                            if (fs.existsSync(userPath)) {
                                const type = userPath.includes('Chromium') ? 'chromium' :
                                    userPath.includes('Edge') ? 'edge' : 'chrome';
                                return { executable: userPath, type };
                            }
                        }
                    }
                }
                catch {
                    // Ignore errors and continue
                }
            }
            continue;
        }
        if (fs.existsSync(chromePath)) {
            const type = chromePath.includes('chromium') || chromePath.includes('Chromium') ? 'chromium' :
                chromePath.includes('edge') || chromePath.includes('Edge') ? 'edge' : 'chrome';
            return { executable: chromePath, type };
        }
    }
    // Try which/where commands
    try {
        if (platform === 'win32') {
            const result = (0, child_process_1.execSync)('where chrome.exe', { encoding: 'utf-8' });
            const firstPath = result.trim().split('\n')[0];
            if (firstPath) {
                return { executable: firstPath.trim(), type: 'chrome' };
            }
        }
        else {
            try {
                const result = (0, child_process_1.execSync)('which google-chrome || which google-chrome-stable || which chromium || which chromium-browser', {
                    encoding: 'utf-8',
                    shell: '/bin/sh'
                });
                const foundPath = result.trim();
                if (foundPath) {
                    const type = foundPath.includes('chromium') ? 'chromium' : 'chrome';
                    return { executable: foundPath, type };
                }
            }
            catch {
                // Command failed, continue to next attempt
            }
        }
    }
    catch {
        // which/where failed
    }
    return null;
}
function createTempUserDataDir() {
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const userDataDir = path.join(tmpDir, `chrome-profile-${timestamp}-${randomId}`);
    fs.mkdirSync(userDataDir, { recursive: true });
    return userDataDir;
}
function waitForDevToolsPort(userDataDir, port, timeoutMs) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const devToolsFile = path.join(userDataDir, 'DevToolsActivePort');
        const checkInterval = setInterval(() => {
            // Check if file exists and contains the port
            try {
                if (fs.existsSync(devToolsFile)) {
                    const content = fs.readFileSync(devToolsFile, 'utf-8');
                    const lines = content.trim().split('\n');
                    if (lines.length >= 2) {
                        const filePort = parseInt(lines[0], 10);
                        if (filePort === port) {
                            clearInterval(checkInterval);
                            resolve();
                            return;
                        }
                    }
                }
            }
            catch {
                // File might not be fully written yet
            }
            // Check timeout
            if (Date.now() - startTime > timeoutMs) {
                clearInterval(checkInterval);
                reject(new Error(`Timeout waiting for DevTools port file after ${timeoutMs}ms`));
            }
        }, 100);
    });
}
async function launchChrome(options = {}) {
    const chrome = findChrome();
    if (!chrome) {
        throw new Error('Chrome not found. Please install Google Chrome, Chromium, or Microsoft Edge.');
    }
    const port = options.port || 9222;
    const userDataDir = options.userDataDir || createTempUserDataDir();
    const headless = options.headless ?? true;
    const args = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=Translate,BackForwardCache,MediaEngagementBypassAutoplayPolicies',
        '--enable-automation',
        '--password-store=basic',
        '--use-mock-keychain',
    ];
    if (headless) {
        args.push('--headless=new');
    }
    // Add a blank page so Chrome starts immediately
    args.push('about:blank');
    const child = (0, child_process_1.spawn)(chrome.executable, args, {
        detached: false,
        stdio: headless ? 'pipe' : 'inherit',
    });
    if (!child.pid) {
        throw new Error('Failed to launch Chrome process');
    }
    // Wait for DevTools port file
    await waitForDevToolsPort(userDataDir, port, 30000);
    let killed = false;
    const instance = {
        pid: child.pid,
        port,
        async kill() {
            if (killed) {
                return;
            }
            killed = true;
            return new Promise((resolve) => {
                // Try graceful termination first
                if (os.platform() === 'win32') {
                    try {
                        (0, child_process_1.execSync)(`taskkill /pid ${child.pid} /T /F`, { stdio: 'pipe' });
                    }
                    catch {
                        // Process might already be dead
                    }
                }
                else {
                    try {
                        process.kill(-child.pid, 'SIGTERM');
                    }
                    catch {
                        // Process might already be dead
                    }
                }
                // Wait a bit then force kill if needed
                setTimeout(() => {
                    try {
                        if (instance.isRunning()) {
                            child.kill('SIGKILL');
                        }
                    }
                    catch {
                        // Process already dead
                    }
                    // Clean up temp directory
                    try {
                        if (fs.existsSync(userDataDir) && !options.userDataDir) {
                            fs.rmSync(userDataDir, { recursive: true, force: true });
                        }
                    }
                    catch {
                        // Ignore cleanup errors
                    }
                    resolve();
                }, 500);
            });
        },
        isRunning() {
            if (killed) {
                return false;
            }
            try {
                process.kill(child.pid, 0); // Signal 0 checks if process exists
                return true;
            }
            catch {
                return false;
            }
        },
    };
    // Handle unexpected process exit
    child.on('exit', (code) => {
        killed = true;
        // Clean up temp directory on unexpected exit
        try {
            if (fs.existsSync(userDataDir) && !options.userDataDir) {
                fs.rmSync(userDataDir, { recursive: true, force: true });
            }
        }
        catch {
            // Ignore cleanup errors
        }
    });
    return instance;
}
