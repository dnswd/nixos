/**
 * Fixture Server for serving HTML test fixtures with dynamic port allocation.
 * Uses Node.js built-in http module for zero dependencies.
 */
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
/**
 * Find a free port on the system.
 * Tries port 0 (OS auto-assign) first, with fallback to manual scan.
 */
export function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (address && typeof address === 'object' && address.port) {
                const port = address.port;
                server.close(() => resolve(port));
            }
            else {
                server.close(() => reject(new Error('Could not determine port')));
            }
        });
        server.on('error', (err) => {
            reject(err);
        });
    });
}
/**
 * Get content type based on file extension.
 */
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
        '.html': 'text/html',
        '.htm': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.txt': 'text/plain',
        '.xml': 'application/xml',
    };
    return types[ext] || 'application/octet-stream';
}
/**
 * Start the fixture server.
 * Serves static files from the specified fixture directory with optional CORS support.
 */
export async function startFixtureServer(options) {
    const { port: requestedPort, fixtureDir, cors = false, logRequests = false, } = options;
    const resolvedFixtureDir = path.resolve(fixtureDir);
    // Validate fixture directory exists
    if (!fs.existsSync(resolvedFixtureDir)) {
        throw new Error(`Fixture directory does not exist: ${resolvedFixtureDir}`);
    }
    // Determine port to use
    let port;
    if (requestedPort === undefined || requestedPort === 0) {
        port = await findFreePort();
    }
    else {
        port = requestedPort;
    }
    const server = createServer((req, res) => {
        // Log request if enabled
        if (logRequests) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] ${req.method} ${req.url}`);
        }
        // Add CORS headers if enabled
        if (cors) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        // Only serve GET/HEAD requests
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return;
        }
        // Resolve file path
        let filePath = req.url || '/';
        // Remove query string and hash
        filePath = filePath.split('?')[0].split('#')[0];
        // Normalize path and prevent directory traversal
        const safePath = path.normalize(filePath).replace(/^\.\.(\/|\\)/, '');
        const fullPath = path.join(resolvedFixtureDir, safePath === '/' ? 'index.html' : safePath);
        // Security check: ensure resolved path is within fixture directory
        if (!fullPath.startsWith(resolvedFixtureDir)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        // Check if file exists and is a file
        fs.stat(fullPath, (err, stats) => {
            if (err || !stats.isFile()) {
                // Try index.html if directory
                if (err && stats?.isDirectory()) {
                    const indexPath = path.join(fullPath, 'index.html');
                    fs.stat(indexPath, (indexErr, indexStats) => {
                        if (indexErr || !indexStats.isFile()) {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('Not Found');
                            return;
                        }
                        serveFile(indexPath, res);
                    });
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            serveFile(fullPath, res);
        });
    });
    function serveFile(filePath, res) {
        const contentType = getContentType(filePath);
        const stream = fs.createReadStream(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        stream.pipe(res);
        stream.on('error', () => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        });
    }
    // Start server
    await new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => {
            resolve();
        });
        server.on('error', (err) => {
            reject(err);
        });
    });
    const url = `http://localhost:${port}`;
    return {
        url,
        port,
        stop: () => {
            return new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        },
        reload: async () => {
            // For now, reload is a no-op placeholder
            // Future implementation could re-scan fixture directory or restart server
            return Promise.resolve();
        },
    };
}
