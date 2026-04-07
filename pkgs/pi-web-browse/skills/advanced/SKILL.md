---
name: browser-advanced
description: Advanced browser automation with network analysis and raw CDP access.
---

## Network Analysis Workflow

### Capture and Export HAR
```
browser_network <target> enable=true
browser_navigate <target> "https://example.com"
browser_click <target> "button#load-data"
browser_network_export <target>
```

HAR includes DNS, SSL, connect, send, wait, receive timings.
Validate at: https://toolbox.googleapps.com/apps/har_analyzer/

## Raw CDP Access

All 644 CDP methods available:
```
browser_cdp <target> "Runtime.getHeapUsage"
browser_cdp <target> "Page.printToPDF" '{"displayHeaderFooter": true}'
browser_cdp <target> "Performance.getMetrics"
```

Full protocol: https://chromedevtools.github.io/devtools-protocol/

## Console Debugging

```
browser_console <target> level=error
browser_console <target> clear=true
```

## Storage Manipulation

```
browser_storage <target> action=setCookie name=session value=abc123 domain=.example.com
browser_storage <target> action=setLocalStorage key=apiKey value=secret123
browser_storage <target> action=clearStorage
```
