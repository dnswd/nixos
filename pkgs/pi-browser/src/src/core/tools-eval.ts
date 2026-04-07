import { getCDPClient } from './cdp-client.js';
import { BrowserError } from './errors.js';

// Track which targets have Runtime enabled
const runtimeEnabledTargets = new Set<string>();

/**
 * Result type for browser_eval
 */
export interface EvalResult {
  result: string;
  type: 'undefined' | 'object' | 'number' | 'string' | 'boolean';
}

/**
 * Evaluate JavaScript expression in the browser context.
 * @param target - The target tab ID
 * @param expression - JavaScript expression to evaluate
 * @param returnByValue - Whether to return the result by value (default: true)
 * @param timeout - Evaluation timeout in milliseconds (default: 30000)
 * @returns Evaluated result with type information
 */
export async function browser_eval({
  target,
  expression,
  returnByValue = true,
  timeout = 30000,
}: {
  target: string;
  expression: string;
  returnByValue?: boolean;
  timeout?: number;
}): Promise<EvalResult> {
  const cdp = await getCDPClient(target);

  // Runtime.enable (one-time per tab - track this)
  if (!runtimeEnabledTargets.has(target)) {
    await cdp.send('Runtime.enable');
    runtimeEnabledTargets.add(target);
  }

  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue,
    awaitPromise: true,
    timeout,
  });

  if (exceptionDetails) {
    throw new BrowserError(
      'JavaScriptError',
      `Line ${exceptionDetails.lineNumber}: ${exceptionDetails.text}`,
      {
        line: exceptionDetails.lineNumber,
        column: exceptionDetails.columnNumber,
      }
    );
  }

  // Determine type and serialize
  let value: string;
  let type: EvalResult['type'];

  switch (result?.type) {
    case 'undefined':
      value = 'undefined';
      type = 'undefined';
      break;
    case 'object':
      if (result?.subtype === 'null') {
        value = 'null';
        type = 'object';
      } else {
        value = JSON.stringify(result?.value);
        type = 'object';
      }
      break;
    case 'number':
    case 'string':
    case 'boolean':
      value = String(result?.value);
      type = result.type;
      break;
    default:
      value = String(result?.value ?? '');
      type = 'object';
  }

  return { result: value, type };
}

/**
 * Unregister a target from runtime tracking (call when tab closes/navigates).
 */
export function unregisterRuntimeTarget(target: string): void {
  runtimeEnabledTargets.delete(target);
}

/**
 * Result type for browser_press
 */
export interface PressResult {
  pressed: boolean;
  key: string;
  count: number;
}

// Key codes for Input.dispatchKeyEvent
const KEY_CODES: Record<string, string> = {
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12',
};

// Windows virtual key codes for Input.dispatchKeyEvent
const WINDOWS_KEY_CODES: Record<string, number> = {
  Enter: 13,
  Escape: 27,
  Tab: 9,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  Backspace: 8,
  Delete: 46,
};

/**
 * Press a specific key (Enter, Escape, Tab, Arrows, etc.).
 * @param target - The target tab ID
 * @param key - The key to press (Enter, Escape, Tab, ArrowUp, etc.)
 * @param count - Number of times to press the key (default: 1)
 * @returns Press result with key information
 */
export async function browser_press({
  target,
  key,
  count = 1,
}: {
  target: string;
  key: string;
  count?: number;
}): Promise<PressResult> {
  const cdp = await getCDPClient(target, true);

  // Map key to code
  const keyCode = KEY_CODES[key] || key;
  const windowsVirtualKeyCode = WINDOWS_KEY_CODES[key] || undefined;

  for (let i = 0; i < count; i++) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code: keyCode,
      windowsVirtualKeyCode,
    });

    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code: keyCode,
      windowsVirtualKeyCode,
    });
  }

  return { pressed: true, key, count };
}
