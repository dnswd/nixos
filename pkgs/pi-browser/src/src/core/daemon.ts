import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { spawn, ChildProcess } from 'child_process';

const CACHE_DIR = path.join(homedir(), '.cache', 'pi-browser');
const SOCKETS_DIR = path.join(CACHE_DIR, 'sockets');

// Track running daemon processes
const daemonProcesses = new Map<string, ChildProcess>();

// Ensure sockets directory exists
function ensureSocketsDir(): void {
  if (!fs.existsSync(SOCKETS_DIR)) {
    fs.mkdirSync(SOCKETS_DIR, { recursive: true });
  }
}

/**
 * Get the socket path for a given tab ID.
 * Uses platform-appropriate paths (named pipes on Windows, Unix sockets otherwise).
 */
export function getSocketPath(tabId: string): string {
  ensureSocketsDir();

  if (process.platform === 'win32') {
    return `\\.\pipe\pi-browser-${tabId}`;
  }

  return path.join(SOCKETS_DIR, `${tabId}.sock`);
}

/**
 * Start a daemon process for the given tab ID.
 * The daemon listens on a Unix socket or Windows named pipe for IPC.
 *
 * @param tabId - The tab ID to start daemon for
 * @throws Error if daemon fails to start
 */
export async function startDaemon(tabId: string): Promise<void> {
  const socketPath = getSocketPath(tabId);

  // Clean up any existing socket file (Unix only)
  if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Detect node path based on platform
  const nodePath = process.platform === 'win32' ? process.execPath : 'node';

  // Determine daemon script path
  // The daemon script should be in the same directory as this file or in a 'daemon' subdirectory
  const daemonScriptPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'daemon',
    'index.js'
  );

  // For now, spawn a simple IPC listener process
  // In a full implementation, this would start the actual daemon script
  // that handles CDP events and NDJSON IPC
  const daemonProcess = spawn(
    nodePath,
    [
      '-e',
      `
      const net = require('net');
      const fs = require('fs');
      const path = require('path');
      
      const socketPath = process.argv[1];
      const tabId = process.argv[2];
      
      // Simple echo daemon for now
      // In full implementation, this would connect to CDP and handle events
      const server = net.createServer((socket) => {
        let buffer = '';
        
        socket.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const req = JSON.parse(line.trim());
                const res = { id: req.id, ok: true, result: { tabId, received: req.cmd } };
                socket.write(JSON.stringify(res) + '\\n');
              } catch (err) {
                socket.write(JSON.stringify({ id: 0, ok: false, error: err.message }) + '\\n');
              }
            }
          }
        });
      });
      
      server.listen(socketPath, () => {
        console.log('Daemon started for tab ' + tabId + ' on ' + socketPath);
      });
      
      // Handle cleanup
      process.on('SIGTERM', () => {
        server.close(() => {
          if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
            fs.unlinkSync(socketPath);
          }
          process.exit(0);
        });
      });
      
      // Keep alive
      setInterval(() => {}, 1000);
      `,
      socketPath,
      tabId,
    ],
    {
      detached: true,
      stdio: 'ignore',
    }
  );

  daemonProcess.unref();

  // Wait a bit for the daemon to start listening
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Verify the socket file exists (Unix) or assume it's ready (Windows)
  if (process.platform !== 'win32') {
    if (!fs.existsSync(socketPath)) {
      throw new Error(`Daemon failed to start: socket file not created at ${socketPath}`);
    }
  }

  // Store the process for cleanup later
  daemonProcesses.set(tabId, daemonProcess);
}

/**
 * Stop the daemon process for the given tab ID.
 * Kills the process and cleans up the socket file.
 *
 * @param tabId - The tab ID to stop daemon for
 */
export async function stopDaemon(tabId: string): Promise<void> {
  const daemonProcess = daemonProcesses.get(tabId);

  if (daemonProcess) {
    // Kill the process
    daemonProcess.kill('SIGTERM');
    daemonProcesses.delete(tabId);
  }

  // Clean up socket file
  const socketPath = getSocketPath(tabId);
  if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if a daemon is running for the given tab ID.
 */
export function isDaemonRunning(tabId: string): boolean {
  const daemonProcess = daemonProcesses.get(tabId);
  return daemonProcess !== undefined && !daemonProcess.killed;
}
