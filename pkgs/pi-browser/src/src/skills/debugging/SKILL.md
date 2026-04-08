---
name: browser-debugging
description: Web debugging with console access, device emulation, and multi-tab workflows.
---

# Browser Debugging

Advanced debugging features for Chrome DevTools Protocol interactions. This skill covers console monitoring, device emulation, multi-tab workflows, wait conditions, semantic element finding, and performance profiling.

## Console Monitoring

Monitor JavaScript console output including logs, warnings, errors, and exceptions.

### Enable console capture

```typescript
await browser_console({ target: "ABC123", enable: true });
```

### Filter by level

```typescript
// Capture only errors
await browser_console({ target: "ABC123", enable: true, level: "error" });

// Capture warnings and above
await browser_console({ target: "ABC123", enable: true, level: "warning" });
```

### Get captured messages

```typescript
const { messages } = await browser_console({ target: "ABC123", enable: false });
// messages: [{ level: "error", text: "Uncaught TypeError...", source: "..." }]
```

### Pattern: Capture errors during navigation

```typescript
await browser_console({ target: "ABC123", enable: true, level: "error" });
await browser_navigate({ target: "ABC123", url: "https://example.com" });
await browser_wait({ target: "ABC123", type: "network", timeout: 5000 });
const { messages } = await browser_console({ target: "ABC123", enable: false });
console.log(`Found ${messages.length} errors`);
```

## Device Emulation

Emulate mobile devices, tablets, and custom viewports for responsive testing.

### Use device presets

```typescript
// iPhone 14 Pro
await browser_emulate({ target: "ABC123", device: "iPhone14Pro" });

// Google Pixel 7
await browser_emulate({ target: "ABC123", device: "Pixel7" });

// iPad
await browser_emulate({ target: "ABC123", device: "iPad" });
```

### Manual viewport configuration

```typescript
await browser_emulate({
  target: "ABC123",
  width: 393,
  height: 852,
  dpr: 3,
  mobile: true,
  touch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0..."
});
```

### Reset to desktop

```typescript
await browser_emulate({ target: "ABC123", clear: true });
```

### Pattern: Test responsive breakpoint

```typescript
// Test mobile layout
await browser_emulate({ target: "ABC123", device: "iPhone14Pro" });
await browser_shot({ target: "ABC123", filename: "mobile.png" });

// Reset and test desktop
await browser_emulate({ target: "ABC123", clear: true });
await browser_shot({ target: "ABC123", filename: "desktop.png" });
```

## Multi-Tab Workflows

Open, switch, and manage multiple browser tabs with independent CDP sessions.

### Open new tab

```typescript
const { tabId } = await browser_tab_open({
  url: "https://example.com",
  activate: true
});
// Returns: { tabId: "ABC123", url: "...", active: true, daemonSocket: "..." }
```

### Switch active tab

```typescript
const result = await browser_tab_switch({ tabId: "ABC123" });
// Returns: { success: true, previousTab: "DEF456", newTab: { id, url, title } }
```

### Close tab and cleanup

```typescript
await browser_tab_close({ tabId: "ABC123" });
// Socket file removed, daemon terminated
```

### Pattern: Open and compare two pages

```typescript
// Open first tab
const tabA = await browser_tab_open({ url: "https://site-a.com", activate: true });
await browser_wait({ target: tabA.tabId, type: "network", timeout: 5000 });
const shotA = await browser_shot({ target: tabA.tabId, filename: "site-a.png" });

// Open second tab
const tabB = await browser_tab_open({ url: "https://site-b.com", activate: true });
await browser_wait({ target: tabB.tabId, type: "network", timeout: 5000 });
const shotB = await browser_shot({ target: tabB.tabB.tabId, filename: "site-b.png" });

// Compare screenshots or data...

// Cleanup
await browser_tab_close({ tabId: tabA.tabId });
await browser_tab_close({ tabId: tabB.tabId });
```

### Pattern: Form submission in new tab

```typescript
// Open form page
const formTab = await browser_tab_open({ url: "https://example.com/form", activate: true });
await browser_wait({ target: formTab.tabId, type: "element", selector: "#submit" });

// Fill and submit
await browser_click({ target: formTab.tabId, selector: "#name" });
await browser_type({ target: formTab.tabId, text: "John Doe" });

// Open result in new tab (ctrl+click simulation via CDP)
const resultTab = await browser_tab_open({ url: "about:blank" });
await browser_eval({
  target: formTab.tabId,
  expression: "document.querySelector('#submit').click()"
});

// Switch to result tab
await browser_tab_switch({ tabId: resultTab.tabId });
await browser_wait({ target: resultTab.tabId, type: "navigation", timeout: 10000 });
const result = await browser_eval({ target: resultTab.tabId, expression: "document.body.innerText" });
```

## Wait Conditions

Wait for page conditions before proceeding with operations.

### Wait for element to appear

```typescript
await browser_wait({
  target: "ABC123",
  type: "element",
  selector: "#dynamic-content",
  timeout: 10000
});
// Returns: { success: true, waitedMs: 2450 }
```

### Wait for network idle

```typescript
await browser_wait({
  target: "ABC123",
  type: "network",
  timeout: 5000
});
// Waits for no network activity for 500ms
```

### Wait for navigation

```typescript
await browser_click({ target: "ABC123", selector: "#navigate-btn" });
await browser_wait({ target: "ABC123", type: "navigation", timeout: 10000 });
```

### Wait for time duration

```typescript
await browser_wait({ target: "ABC123", type: "time", duration: 2000 });
```

### Wait for JavaScript condition

```typescript
await browser_wait({
  target: "ABC123",
  type: "function",
  expression: "document.readyState === 'complete' && window.dataLoaded === true",
  timeout: 15000
});
```

### Pattern: Wait for dynamic content

```typescript
// Trigger lazy loading
await browser_click({ target: "ABC123", selector: "#load-more" });

// Wait for new items to appear
await browser_wait({
  target: "ABC123",
  type: "function",
  expression: "document.querySelectorAll('.item').length > 10",
  timeout: 5000
});

// Extract the new content
const items = await browser_eval({
  target: "ABC123",
  expression: "Array.from(document.querySelectorAll('.item')).map(i => i.textContent)"
});
```

## Semantic Locators

Find elements by accessibility properties (ARIA role, accessible name) rather than CSS selectors.

### Find by role

```typescript
const result = await browser_find({ target: "ABC123", role: "button" });
// Returns all buttons with coordinates and selectors
```

### Find by role and name

```typescript
const result = await browser_find({
  target: "ABC123",
  role: "button",
  name: "Submit"
});
// Returns: { found: true, elements: [{ role, name, selector, x, y, width, height }] }
```

### Find headings by level

```typescript
const h1 = await browser_find({ target: "ABC123", role: "heading", level: 1 });
const allHeadings = await browser_find({ target: "ABC123", role: "heading" });
```

### Find form elements

```typescript
const textboxes = await browser_find({ target: "ABC123", role: "textbox" });
const checkboxes = await browser_find({ target: "ABC123", role: "checkbox" });
```

### Pattern: Click by accessible name

```typescript
const { elements } = await browser_find({
  target: "ABC123",
  role: "button",
  name: "Add to Cart"
});
if (elements.length > 0) {
  await browser_clickxy({
    target: "ABC123",
    x: elements[0].x + elements[0].width / 2,
    y: elements[0].y + elements[0].height / 2
  });
}
```

## Performance Timing

Measure page performance using the Performance API via JavaScript evaluation.

### Get navigation timing

```typescript
const timing = await browser_eval({
  target: "ABC123",
  expression: `
    const nav = performance.getEntriesByType('navigation')[0];
    JSON.stringify({
      dns: nav.domainLookupEnd - nav.domainLookupStart,
      connect: nav.connectEnd - nav.connectStart,
      ttfb: nav.responseStart - nav.requestStart,
      download: nav.responseEnd - nav.responseStart,
      dom: nav.domComplete - nav.domInteractive,
      load: nav.loadEventEnd - nav.startTime
    })
  `
});
console.log(JSON.parse(timing));
// { dns: 25, connect: 120, ttfb: 45, download: 80, dom: 350, load: 890 }
```

### Get resource timing

```typescript
const resources = await browser_eval({
  target: "ABC123",
  expression: `
    performance.getEntriesByType('resource')
      .filter(r => r.duration > 100)
      .map(r => ({ name: r.name, duration: r.duration }))
      .slice(0, 10)
  `
});
```

### Measure custom marks

```typescript
// Set a mark before action
await browser_eval({
  target: "ABC123",
  expression: "performance.mark('action-start')"
});

// Perform action...
await browser_click({ target: "ABC123", selector: "#trigger" });

// Measure elapsed
const measure = await browser_eval({
  target: "ABC123",
  expression: `
    performance.mark('action-end');
    performance.measure('action', 'action-start', 'action-end');
    performance.getEntriesByName('action')[0].duration
  `
});
```

### Pattern: Full performance audit

```typescript
await browser_navigate({ target: "ABC123", url: "https://example.com" });
await browser_wait({ target: "ABC123", type: "network", timeout: 10000 });

const audit = await browser_eval({
  target: "ABC123",
  expression: `
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    {
      ttfb: nav.responseStart - nav.requestStart,
      fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
      lcp: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime,
      cls: performance.getEntriesByType('layout-shift')
        .reduce((sum, s) => sum + (s.hadRecentInput ? 0 : s.value), 0)
    }
  `
});
```

## Memory Profiling

Profile JavaScript heap usage and detect memory leaks via CDP.

### Get heap usage

```typescript
const heap = await browser_cdp({
  target: "ABC123",
  method: "Runtime.getHeapUsage"
});
// Returns: { usedSize: 12345678, totalSize: 23456789 }
```

### Take heap snapshot

```typescript
await browser_cdp({
  target: "ABC123",
  method: "HeapProfiler.enable"
});

await browser_cdp({
  target: "ABC123",
  method: "HeapProfiler.takeHeapSnapshot",
  params: { reportProgress: false }
});
```

### Collect garbage

```typescript
await browser_cdp({
  target: "ABC123",
  method: "HeapProfiler.collectGarbage"
});
```

### Pattern: Detect memory leaks

```typescript
// Baseline
await browser_cdp({ target: "ABC123", method: "HeapProfiler.collectGarbage" });
const baseline = await browser_cdp({ target: "ABC123", method: "Runtime.getHeapUsage" });

// Perform suspected leaky action 10 times
for (let i = 0; i < 10; i++) {
  await browser_click({ target: "ABC123", selector: "#open-modal" });
  await browser_click({ target: "ABC123", selector: "#close-modal" });
}

// Check growth
await browser_cdp({ target: "ABC123", method: "HeapProfiler.collectGarbage" });
const after = await browser_cdp({ target: "ABC123", method: "Runtime.getHeapUsage" });

const growth = after.usedSize - baseline.usedSize;
console.log(`Heap growth: ${growth / 1024 / 1024} MB`);
// Significant growth without corresponding DOM growth suggests a leak
```

## Tips

- Use `browser_tab_open` with `activate: false` to open background tabs without switching focus
- Always use `browser_tab_close` to cleanup - this terminates the daemon and frees resources
- Combine `browser_find` with `browser_clickxy` for resilient element interaction
- Use `browser_wait({ type: "network" })` after triggering AJAX requests
- Console monitoring persists until explicitly disabled - remember to turn it off
- Device emulation affects viewport only - user agent may need manual override for server-side detection
