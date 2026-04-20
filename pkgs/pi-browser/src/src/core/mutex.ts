import { BrowserError, ErrorCode } from './errors.js';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

const CACHE_DIR = path.join(homedir(), '.cache', 'pi-browser');
const MUTEX_DIR = path.join(CACHE_DIR, 'mutex');

// Session identifier for lock ownership tracking
const SESSION_ID = randomUUID();

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
 * Check if a process is alive by sending signal 0 (no actual signal sent).
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

interface LockFileContent {
  pid: number;
  session?: string;
  timestamp: number;
  operation: string;
}

/**
 * Read lock file content if it exists.
 */
function readLockFile(tabId: string): LockFileContent | null {
  const mutexPath = getMutexPath(tabId);
  if (!fs.existsSync(mutexPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(mutexPath, 'utf-8')) as LockFileContent;
  } catch {
    return null;
  }
}

/**
 * Diagnose all current mutex locks.
 * Returns information about held locks without modifying them.
 */
export interface LockDiagnostic {
  tabId: string;
  holderPid: number;
  holderAlive: boolean;
  isOurSession: boolean;
  ageMs: number;
  operation: string;
}

export async function diagnoseLocks(): Promise<LockDiagnostic[]> {
  const results: LockDiagnostic[] = [];

  if (!fs.existsSync(MUTEX_DIR)) {
    return results;
  }

  const files = fs.readdirSync(MUTEX_DIR).filter((f) => f.endsWith('.lock'));

  for (const file of files) {
    const tabId = file.replace('.lock', '');
    const content = readLockFile(tabId);

    if (content) {
      results.push({
        tabId,
        holderPid: content.pid,
        holderAlive: isProcessAlive(content.pid),
        isOurSession: content.session === SESSION_ID,
        ageMs: Date.now() - content.timestamp,
        operation: content.operation,
      });
    }
  }

  return results;
}

/**
 * Cleanup stale locks with optional filters.
 * @param options.maxAgeMs - Only clean locks older than this
 * @param options.ourSessionOnly - Only clean locks from our crashed session
 * @param options.force - Also kill live holder processes (DANGEROUS)
 * @returns List of cleaned tab IDs
 */
export async function cleanupStaleLocks(options?: {
  maxAgeMs?: number;
  ourSessionOnly?: boolean;
  force?: boolean;
}): Promise<string[]> {
  const cleaned: string[] = [];
  const locks = await diagnoseLocks();

  for (const lock of locks) {
    let shouldClean = false;

    // Only clean our crashed session locks
    if (options?.ourSessionOnly && lock.isOurSession && !lock.holderAlive) {
      shouldClean = true;
    }

    // Clean locks older than threshold (any session)
    if (options?.maxAgeMs && lock.ageMs > options.maxAgeMs) {
      shouldClean = true;
    }

    // Force clean even live processes (DANGEROUS - use with caution)
    if (options?.force) {
      shouldClean = true;
      if (lock.holderAlive) {
        try {
          process.kill(lock.holderPid, 'SIGTERM');
          // Give it a moment to die
          await sleep(100);
        } catch {
          // Process might already be dead
        }
      }
    }

    if (shouldClean) {
      const mutexPath = getMutexPath(lock.tabId);
      try {
        if (fs.existsSync(mutexPath)) {
          fs.unlinkSync(mutexPath);
          cleaned.push(lock.tabId);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return cleaned;
}

/**
 * Force release a specific mutex (for recovery from crashed operations).
 * Requires explicit user action - no auto-cleanup.
 */
export async function forceReleaseMutex(tabId: string): Promise<boolean> {
  const mutexPath = getMutexPath(tabId);
  try {
    if (fs.existsSync(mutexPath)) {
      fs.unlinkSync(mutexPath);
      return true;
    }
  } catch {
    // Ignore errors
  }
  return false;
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
 * NO auto-cleanup - use diagnoseLocks() and cleanupStaleLocks() for recovery.
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
      // Try to create exclusive lock file - NO auto-cleanup
      const lockContent = JSON.stringify({
        pid: process.pid,
        session: SESSION_ID,
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

  // Timeout exceeded - provide diagnostic info for manual recovery
  const currentLock = readLockFile(tabId);
  const diagnosticInfo = currentLock
    ? `Held by PID ${currentLock.pid} (${isProcessAlive(currentLock.pid) ? 'alive' : 'dead'}) for operation "${currentLock.operation}" (${Date.now() - currentLock.timestamp}ms old). Use cleanupStaleLocks() or forceReleaseMutex() to recover.`
    : 'Lock file disappeared during acquisition';

  throw new BrowserError(
    ErrorCode.TabBusy,
    `Tab ${tabId} is busy. ${diagnosticInfo}`,
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
