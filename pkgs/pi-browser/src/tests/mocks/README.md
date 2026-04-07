# Test Mocks

## MockCDPServer

WebSocket CDP mock server for testing pi-browser without real Chrome.

### Usage

```typescript
import { MockCDPServer } from './mock-cdp.js';

const server = new MockCDPServer(9222);
await server.start();

// Add a mock tab
const targetId = server.addTab({
  url: 'https://example.com',
  title: 'Example'
});

// Set page content
server.setPageContent(targetId, '<html><body><h1>Test</h1></body></html>');

// Simulate navigation
server.simulateNavigation(targetId, 'https://new.com');

// Inject console messages
server.injectConsole(targetId, 'log', 'Hello from mock');

// Fire custom events
server.fireEvent(targetId, 'Network.requestWillBeSent', {
  requestId: '1',
  url: 'https://example.com/api'
});

await server.stop();
```

### CDP Methods Implemented

| Method | Description |
|--------|-------------|
| `Target.getTargets` | Returns list of mock tabs |
| `Target.createTarget` | Creates a new mock tab |
| `Target.attachToTarget` | Attaches to a tab for debugging |
| `Target.detachFromTarget` | Detaches from a tab |
| `Target.closeTarget` | Closes a tab |
| `Page.enable` | Enables Page domain events |
| `Page.navigate` | Simulates navigation with events |
| `Page.reload` | Simulates page reload |
| `Page.captureScreenshot` | Returns deterministic mock PNG |
| `Runtime.enable` | Enables Runtime domain |
| `Runtime.evaluate` | Evaluates expressions in mock context |
| `DOM.enable` | Enables DOM domain |
| `DOM.getDocument` | Returns mock document root |
| `DOM.querySelector` | Returns mock node ID |
| `Network.enable/disable` | Enables/disables Network events |
| `Network.setCacheDisabled` | Mock cache control |
| `Accessibility.getFullAXTree` | Returns mock a11y tree |
| `Input.dispatchMouseEvent` | Mock mouse events |
| `Input.dispatchKeyEvent` | Mock keyboard events |

### HTTP Endpoints

- `/json/version` - Returns browser version info
- `/json/list` - Returns list of available targets

### Events Fired

- `Page.loadEventFired` - After navigation completes
- `Network.requestWillBeSent` - When navigation starts
- `Network.responseReceived` - When response received
- `Runtime.consoleAPICalled` - Via `injectConsole()`

### Configuration

```typescript
// Set artificial latency (ms)
server.setLatency(500);

// Inject errors for specific methods
server.injectError('Target.getTargets', -32000, 'Test error');

// Clear injected errors
server.clearError('Target.getTargets');
```

### Mock Screenshot

`Page.captureScreenshot` returns a deterministic 1x1 red PNG (base64 encoded).

### Running Tests

```bash
npm install
npm run test:mock
```
