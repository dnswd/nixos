export class BrowserError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BrowserError';
  }
}

// Error codes enum (extend existing from Phase 0)
export const ErrorCode = {
  // Phase 0 errors (existing)
  ChromeNotFound: 'ChromeNotFound',
  TabNotFound: 'TabNotFound',
  ConnectionLost: 'ConnectionLost',
  TabBusy: 'TabBusy',

  // Phase 1 errors (new)
  ElementNotFound: 'ElementNotFound',
  ElementNotVisible: 'ElementNotVisible',
  ElementNotInteractive: 'ElementNotInteractive',
  InvalidCoordinates: 'InvalidCoordinates',
  InputRejected: 'InputRejected',
  JavaScriptError: 'JavaScriptError',
  StaleElement: 'StaleElement',

  // Phase 2 errors (new)
  NetworkCaptureError: 'NetworkCaptureError',
  CDPError: 'CDPError',
  InvalidCDPMethod: 'InvalidCDPMethod',
  StorageError: 'StorageError',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];
