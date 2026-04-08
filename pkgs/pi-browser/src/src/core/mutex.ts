import { BrowserError, ErrorCode } from './errors.js';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const CACHE_DIR = path.join(homedir(), '.cache', 'pi-browser');
const MUTEX_DIR = path.join(CACHE_DIR, 'mutex');

// Ensure mutex directory exists
function ensureMutexDir(): void {
  if (!fs.existsSync(MUTEX_DIR)) {
    fs.mkdirSync(MUTEX_DIR, { recursive: true });
  }
}

/**
 * Get the mutex file path for a tab ID.
 */
function getMutexPath(tabId: string): string {
  ensureMutexDir();
  return path.join(MUTEX_DIR, `${tabId}.lock`);
}

/**
 * Check if a mutex is held for the given tab ID.
 */
export function isMutexHeld(tabId: string): boolean {
  const mutexPath = getMutexPath(tabId);
  return fs.existsSync(mutexPath);
}

/**
 * Try to acquire a mutex for the given tab ID.
 * Uses exponential backoff (1s, 2s, 4s, 8s, 16s) up to the specified timeout.
 *
 * @param tabId - The tab ID to acquire mutex for
 * @param options - Acquisition options
 * @throws BrowserError with code 'TabBusy' if timeout is exceeded
 */
export async function acquireMutex(
  tabId: string,
  options: { timeout: number; operation: string }
): Promise<void> {
  const mutexPath = getMutexPath(tabId);
  const startTime = Date.now();
  let backoff = 1000; // Start with 1 second
  const maxBackoff = 16000; // Max 16 seconds

  while (Date.now() - startTime < options.timeout) {
    try {
      // Try to create exclusive lock file
      const lockContent = JSON.stringify({
        pid: process.pid,
        timestamp: Date.now(),
        operation: options.operation,
      });

      // Use O_EXCL flag for atomic creation
      try {
        const fd = fs.openSync(mutexPath, 'wx');
        fs.writeFileSync(fd, lockContent);
        fs.closeSync(fd);
        return; // Acquired successfully
      } catch (err) {
        // File exists, someone else holds the lock
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          // Wait and retry with backoff
          await sleep(backoff);
          backoff = Math.min(backoff * 2, maxBackoff);
          continue;
        }
        throw err; // Other error, rethrow
      }
    } catch (err) {
      // On unexpected errors, wait and retry
      await sleep(backoff);
      backoff = Math.min(backoff * 2, maxBackoff);
    }
  }

  // Timeout exceeded
  throw new BrowserError(
    ErrorCode.TabBusy,
    `Tab ${tabId} is busy with operation, try again`,
    { tabId, operation: options.operation, timeout: options.timeout }
  );
}

/**
 * Release the mutex for the given tab ID.
 */
export async function releaseMutex(tabId: string): Promise<void> {
  const mutexPath = getMutexPath(tabId);

  try {
    if (fs.existsSync(mutexPath)) {
      fs.unlinkSync(mutexPath);
    }
  } catch {
    // Ignore errors during release (file might not exist)
  }
}

/**
 * Sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
