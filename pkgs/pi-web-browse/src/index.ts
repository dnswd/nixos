// Core evaluation tools
export {
  browser_eval,
  browser_press,
  unregisterRuntimeTarget,
  type EvalResult,
  type PressResult,
} from './core/tools-eval.js';

// Re-export other tools from their modules
export {
  browser_click,
  browser_clickxy,
  browser_type,
  browser_fill,
  browser_scroll,
  unregisterDOMTarget,
  type ClickResult,
  type ClickXYResult,
  type TypeResult,
  type FillResult,
  type ScrollResult,
} from './core/tools-dom.js';

// Page tools
export {
  browser_html,
  browser_text,
  browser_shot,
  registerCDPClient,
  unregisterCDPClient,
  type CDPClient,
  type HTMLResult,
  type TextResult,
  type ScreenshotResult,
} from './core/tools-page.js';

// Console tools
export {
  browser_console,
  type ConsoleResult,
  type ConsoleLevel,
} from './core/tools-console.js';

// Navigation tools
export {
  browser_back,
  browser_forward,
  type HistoryResult,
} from './core/tools-nav.js';

// Errors
export { BrowserError, ErrorCode, type ErrorCodeType } from './core/errors.js';
