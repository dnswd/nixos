import { getCDPClient } from './cdp-client.js';
import { BrowserError } from './errors.js';
import { browser_eval } from './tools-eval.js';

// CDP Response Types
interface DOMGetDocumentResponse {
  root: {
    nodeId: number;
  };
}

interface DOMQuerySelectorResponse {
  nodeId: number;
}

interface DOMGetBoxModelResponse {
  model: {
    content: number[];
  };
}

interface DOMDescribeNodeResponse {
  node: {
    nodeName: string;
    attributes?: string[];
  };
}

interface RuntimeEvaluateResponse {
  result: {
    value?: string;
    type?: string;
  };
}

// Track which targets have DOM enabled
const domEnabledTargets = new Set<string>();

// Sleep utility for wait delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Click result type
export interface ClickResult {
  clicked: boolean;
  selector: string;
  coordinates: { x: number; y: number };
  element: {
    tag: string;
    id?: string;
    class?: string;
  };
}

// ClickXY result type
export interface ClickXYResult {
  clicked: boolean;
  coordinates: { x: number; y: number };
}

// Type result type
export interface TypeResult {
  typed: boolean;
  length: number;
}

// Fill result type
export interface FillResult {
  filled: boolean;
  selector: string;
  submitted: boolean;
}

// Scroll result type
export interface ScrollResult {
  scrolled: boolean;
  x: number;
  y: number;
}

// Re-export EvalResult for backward compatibility
export type { EvalResult } from './tools-eval.js';
export { browser_eval, unregisterRuntimeTarget } from './tools-eval.js';

/**
 * Click on an element by selector.
 * @param target - The target tab ID
 * @param selector - CSS selector for the element to click
 * @param waitForStable - Delay between mouse move and click in ms (default: 50)
 * @returns Click result with coordinates and element info
 */
export async function browser_click({
  target,
  selector,
  waitForStable = 50,
}: {
  target: string;
  selector: string;
  waitForStable?: number;
}): Promise<ClickResult> {
  const cdp = await getCDPClient(target);

  // DOM.enable (one-time per tab)
  if (!domEnabledTargets.has(target)) {
    await cdp.send('DOM.enable');
    domEnabledTargets.add(target);
  }

  // Get document nodeId
  const { root } = await cdp.send('DOM.getDocument') as DOMGetDocumentResponse;

  // Query selector
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector,
  }) as DOMQuerySelectorResponse;

  if (nodeId === 0) {
    throw new BrowserError('ElementNotFound', `Element not found: "${selector}"`);
  }

  // Get box model for visibility check and coordinates
  let boxModel: DOMGetBoxModelResponse;
  try {
    boxModel = await cdp.send('DOM.getBoxModel', { nodeId }) as DOMGetBoxModelResponse;
  } catch {
    throw new BrowserError('ElementNotVisible', `Element found but not visible: "${selector}"`);
  }

  // Check visibility (width/height > 0)
  const content = boxModel.model.content;
  const width = content[2] - content[0];
  const height = content[5] - content[1];
  if (width === 0 || height === 0) {
    throw new BrowserError('ElementNotVisible', `Element has zero size: "${selector}"`);
  }

  // Calculate center point
  const x = (content[0] + content[2]) / 2;
  const y = (content[1] + content[5]) / 2;

  // Dispatch mouse events (3 events for reliable click)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
  });

  if (waitForStable > 0) {
    await sleep(waitForStable);
  }

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });

  // Get element info
  const { node } = await cdp.send('DOM.describeNode', { nodeId }) as DOMDescribeNodeResponse;

  // Extract attributes from flat array [name1, value1, name2, value2, ...]
  const attributes = node.attributes || [];
  let id: string | undefined;
  let className: string | undefined;

  for (let i = 0; i < attributes.length; i += 2) {
    const attrName = attributes[i];
    const attrValue = attributes[i + 1];
    if (attrName === 'id') {
      id = attrValue;
    } else if (attrName === 'class') {
      className = attrValue;
    }
  }

  return {
    clicked: true,
    selector,
    coordinates: { x: Math.round(x), y: Math.round(y) },
    element: {
      tag: node.nodeName.toLowerCase(),
      id,
      class: className,
    },
  };
}

/**
 * Click at specific coordinates (works with shadow DOM, cross-origin iframes).
 * @param target - The target tab ID
 * @param x - X coordinate in CSS pixels
 * @param y - Y coordinate in CSS pixels
 * @param waitForStable - Delay between mouse move and click in ms (default: 50)
 * @returns Click result with coordinates
 */
export async function browser_clickxy({
  target,
  x,
  y,
  waitForStable = 50,
}: {
  target: string;
  x: number;
  y: number;
  waitForStable?: number;
}): Promise<ClickXYResult> {
  // Validate coordinates
  if (x < 0 || y < 0) {
    throw new BrowserError(
      'InvalidCoordinates',
      `Invalid coordinates: (${x}, ${y}). Must be non-negative.`,
      { x, y }
    );
  }

  const cdp = await getCDPClient(target);

  // Optional: warn if out of viewport (get viewport size)
  const { result: vp } = await cdp.send('Runtime.evaluate', {
    expression: 'JSON.stringify({ width: window.innerWidth, height: window.innerHeight })',
    returnByValue: true,
  }) as RuntimeEvaluateResponse;
  if (!vp.value) {
    throw new BrowserError('EvaluationFailed', 'Failed to get viewport dimensions');
  }
  const viewport = JSON.parse(vp.value);

  if (x > viewport.width || y > viewport.height) {
    // Log warning but don't fail - element might be in iframe
    console.warn(`Click coordinates (${x}, ${y}) may be outside viewport (${viewport.width}x${viewport.height})`);
  }

  // Dispatch same 3-event sequence
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
  });

  if (waitForStable > 0) {
    await sleep(waitForStable);
  }

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });

  return {
    clicked: true,
    coordinates: { x, y },
  };
}

/**
 * Unregister a target from DOM tracking (call when tab closes/navigates).
 */
export function unregisterDOMTarget(target: string): void {
  domEnabledTargets.delete(target);
}

/**
 * Type text at current focus (works in cross-origin iframes).
 * @param target - The target tab ID
 * @param text - Text to type
 * @param delayMs - Delay between keystrokes in ms (default: 0 for instant)
 * @returns Type result with success status and length
 */
export async function browser_type({
  target,
  text,
  delayMs = 0,
  submit = false,
}: {
  target: string;
  text: string;
  delayMs?: number;
  submit?: boolean;
}): Promise<TypeResult> {
  const cdp = await getCDPClient(target);

  // Input domain works at browser level (bypasses SOP)
  if (delayMs === 0) {
    // Fast path: insert all at once
    await cdp.send('Input.insertText', { text });
  } else {
    // Slow path: character by character
    for (const char of text) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        text: char,
      });
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        text: char,
      });
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  // Optional submit with Enter key
  if (submit) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
    });
  }

  return { typed: true, length: text.length };
}

/**
 * Scroll page or element into view.
 * @param target - The target tab ID
 * @param direction - Scroll direction for page scrolling
 * @param amount - Amount to scroll (defaults to viewport size)
 * @param selector - CSS selector for element to scroll into view (optional)
 * @returns Scroll result with new position
 */
export async function browser_scroll({
  target,
  direction,
  amount,
  selector,
}: {
  target: string;
  direction: 'up' | 'down' | 'left' | 'right' | 'top' | 'bottom';
  amount?: number;
  selector?: string;
}): Promise<ScrollResult> {
  if (selector) {
    // Scroll element into view
    const result = await browser_eval({
      target,
      expression: `
        (() => {
          const el = document.querySelector('${selector}');
          if (el) {
            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            return 'scrolled';
          }
          return null;
        })()
      `,
    });

    if (result.result === 'null') {
      throw new BrowserError('ElementNotFound', `Element not found: "${selector}"`);
    }
  } else {
    // Page scroll
    const scrollExpr = {
      up: `window.scrollBy(0, -${amount || 'window.innerHeight'})`,
      down: `window.scrollBy(0, ${amount || 'window.innerHeight'})`,
      left: `window.scrollBy(-${amount || 'window.innerWidth'}, 0)`,
      right: `window.scrollBy(${amount || 'window.innerWidth'}, 0)`,
      top: `window.scrollTo(0, 0)`,
      bottom: `window.scrollTo(0, document.body.scrollHeight)`,
    }[direction];

    await browser_eval({ target, expression: scrollExpr });
  }

  // Get new position
  const pos = await browser_eval({
    target,
    expression: `JSON.stringify({ x: window.scrollX, y: window.scrollY })`,
  });

  const { x, y } = JSON.parse(pos.result);

  return { scrolled: true, x, y };
}

/**
 * Fill a form field with value (click, clear, type, optional submit).
 * SECURITY NOTE: For sensitive forms (e.g., authentication), use explicit
 * click+type sequence instead of fill to avoid logging sensitive data.
 * @param target - The target tab ID
 * @param selector - CSS selector for the input element
 * @param value - Value to fill in
 * @param clear - Whether to clear the field first (default: true)
 * @param submit - Whether to submit the form after filling (default: false)
 * @returns Fill result with success status and submission info
 */
export async function browser_fill({
  target,
  selector,
  value,
  clear = true,
  submit = false,
}: {
  target: string;
  selector: string;
  value: string;
  clear?: boolean;
  submit?: boolean;
}): Promise<FillResult> {
  // 1. Click to focus
  await browser_click({ target, selector });

  // 2. Clear if requested
  if (clear) {
    await browser_eval({
      target,
      expression: 'document.activeElement.value = ""',
    });
  }

  // 3. Type value
  await browser_type({ target, text: value });

  // 4. Submit if requested
  let submitted = false;
  if (submit) {
    const evalResult = await browser_eval({
      target,
      expression: `
        (() => {
          const el = document.activeElement;
          if (el && el.form) {
            el.form.dispatchEvent(new Event('submit', { bubbles: true }));
            return 'submitted';
          }
          return 'no-form';
        })()
      `,
    });
    submitted = evalResult.result === 'submitted';
  }

  return {
    filled: true,
    selector,
    submitted,
  };
}
