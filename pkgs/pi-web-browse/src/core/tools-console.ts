import { getCDPClient } from './tools-page.js';

// Console entry type
export interface ConsoleEntry {
  level: 'error' | 'warning' | 'info' | 'log' | 'debug';
  message: string;
  source: string;
  line?: number;
  column?: number;
  timestamp: number;
}

// Result type for browser_console
export interface ConsoleResult {
  logs: Array<{
    level: 'error' | 'warning' | 'info' | 'log' | 'debug';
    message: string;
    source: string;
    line?: number;
    timestamp: number;
  }>;
  count: number;
  capturing?: boolean;
  entriesCount?: number;
}

// Console buffer per target
const consoleBuffers = new Map<string, ConsoleEntry[]>();

// Track which targets have console enabled
const consoleEnabledTargets = new Set<string>();

// Level priority for filtering (lower = more severe)
const levelPriority: Record<ConsoleEntry['level'], number> = {
  error: 0,
  warning: 1,
  info: 2,
  log: 3,
  debug: 4,
};

/**
 * Get console buffer for a target
 */
export function getConsoleBuffer(target: string): ConsoleEntry[] {
  if (!consoleBuffers.has(target)) {
    consoleBuffers.set(target, []);
  }
  return consoleBuffers.get(target)!;
}

/**
 * Add console entry to buffer
 */
export function addConsoleEntry(target: string, entry: ConsoleEntry): void {
  const buffer = getConsoleBuffer(target);
  buffer.push(entry);

  // Limit buffer size to 1000 entries per tab
  if (buffer.length > 1000) {
    buffer.shift();
  }
}

/**
 * Clear console buffer for a target
 */
export function clearConsoleBuffer(target: string): void {
  consoleBuffers.set(target, []);
}

/**
 * Get console entries from buffer (filtered by level)
 */
export function getConsoleEntries(target: string, level: 'all' | ConsoleEntry['level'] = 'all'): ConsoleEntry[] {
  const buffer = getConsoleBuffer(target);

  if (level === 'all') {
    return [...buffer];
  }

  const filterPriority = levelPriority[level];
  return buffer.filter(e => levelPriority[e.level] <= filterPriority);
}

/**
 * Get console buffer size for a target
 */
export function getConsoleBufferSize(target: string): number {
  return getConsoleBuffer(target).length;
}

/**
 * Check if console capture is enabled for target
 */
export function isConsoleEnabled(target: string): boolean {
  return consoleEnabledTargets.has(target);
}

/**
 * Enable console capture for a target
 */
export async function enableConsoleCapture(target: string): Promise<void> {
  if (consoleEnabledTargets.has(target)) {
    // Clear buffer on re-enable
    clearConsoleBuffer(target);
    return;
  }

  const cdp = await getCDPClient(target);

  // Enable Runtime domain for console API events
  await cdp.send('Runtime.enable');

  // Enable Log domain for additional log entries
  await cdp.send('Log.enable');

  // Set up event handlers
  cdp.on('Runtime.consoleAPICalled', (params: unknown) => {
    const consoleParams = params as {
      type: string;
      args: Array<{ value?: unknown; description?: string }>;
      timestamp: number;
      stackTrace?: {
        callFrames: Array<{
          functionName: string;
          url: string;
          lineNumber: number;
          columnNumber: number;
        }>;
      };
    };
    
    const message = consoleParams.args.map(arg => 
      String(arg.value ?? arg.description ?? '')
    ).join(' ');
    
    const entry: ConsoleEntry = {
      level: consoleParams.type as ConsoleEntry['level'],
      message,
      source: consoleParams.stackTrace?.callFrames[0]?.url ?? '',
      line: consoleParams.stackTrace?.callFrames[0]?.lineNumber,
      timestamp: consoleParams.timestamp,
    };
    
    if (consoleParams.stackTrace) {
      (entry as any).stackTrace = consoleParams.stackTrace.callFrames.slice(0, 5).map(frame => ({
        functionName: frame.functionName,
        url: frame.url,
        lineNumber: frame.lineNumber,
        columnNumber: frame.columnNumber,
      }));
    }
    
    addConsoleEntry(target, entry);
  });

  cdp.on('Log.entryAdded', (params: unknown) => {
    const logParams = params as {
      entry: {
        level: string;
        text: string;
        source?: string;
        url?: string;
        lineNumber?: number;
        columnNumber?: number;
        timestamp: number;
      };
    };
    
    const entry: ConsoleEntry = {
      level: logParams.entry.level as ConsoleEntry['level'],
      message: logParams.entry.text,
      source: logParams.entry.url ?? logParams.entry.source ?? 'browser',
      line: logParams.entry.lineNumber,
      timestamp: logParams.entry.timestamp,
    };
    
    addConsoleEntry(target, entry);
  });

  consoleEnabledTargets.add(target);
}

/**
 * Disable console capture for a target
 */
export async function disableConsoleCapture(target: string): Promise<void> {
  if (!consoleEnabledTargets.has(target)) {
    return;
  }

  const cdp = await getCDPClient(target);

  // Disable domains
  await cdp.send('Runtime.disable').catch(() => {});
  await cdp.send('Log.disable').catch(() => {});

  consoleEnabledTargets.delete(target);
}

/**
 * Capture console logs from the browser.
 * @param target - The target tab ID
 * @param clear - Whether to clear the buffer after reading (default: false)
 * @param level - Log level filter (default: 'all')
 * @param enable - Whether to enable or disable console capture
 * @returns Console logs with metadata
 */
export async function browser_console({
  target,
  clear = false,
  level = 'all',
  enable,
}: {
  target: string;
  clear?: boolean;
  level?: 'all' | 'error' | 'warning' | 'info' | 'log';
  enable?: boolean;
}): Promise<ConsoleResult> {
  // Handle enable/disable
  if (enable === true) {
    await enableConsoleCapture(target);
  } else if (enable === false) {
    // Just return current status without enabling
    const entries = getConsoleBuffer(target);
    return {
      logs: [],
      count: 0,
      capturing: false,
      entriesCount: entries.length,
    };
  }

  // Enable console capture if not already enabled
  await enableConsoleCapture(target);

  // Get all entries from buffer
  const entries = getConsoleBuffer(target);

  // Filter by level
  let logs: ConsoleEntry[];
  if (level === 'all') {
    logs = [...entries];
  } else {
    const filterPriority = levelPriority[level];
    logs = entries.filter(e => levelPriority[e.level] <= filterPriority);
  }

  // Clear buffer if requested
  if (clear) {
    clearConsoleBuffer(target);
  }

  return {
    logs: logs.map(e => ({
      level: e.level,
      message: e.message,
      source: e.source,
      line: e.line,
      timestamp: e.timestamp,
    })),
    count: logs.length,
  };
}

/**
 * Unregister a target from console tracking (call when tab closes/navigates).
 */
export function unregisterConsoleTarget(target: string): void {
  consoleEnabledTargets.delete(target);
  consoleBuffers.delete(target);
}
