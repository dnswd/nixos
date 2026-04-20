import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { browser_shot, browser_html } from "./core/tools-page.js";
import { browser_network, browser_network_export, browser_cdp, browser_set_headers } from "./core/tools-network.js";
import { browser_console } from "./core/tools-console.js";
import { browser_storage, BrowserStorageSchema } from "./core/tools-storage.js";
import { browser_list, browser_navigate, browser_snap } from "./core/tools-nav.js";
import { browser_tab_open, browser_tab_switch, browser_tab_close } from "./core/tools-tab.js";
import { browser_wait } from "./core/tools-wait.js";
import { browser_find } from "./core/tools-find.js";
import { browser_emulate } from "./extras/tools-emulation.js";
import { diagnoseLocks, cleanupStaleLocks } from "./core/mutex.js";
import { screenshotRenderer } from "./renderers.js";

export default function (pi: ExtensionAPI) {
  // Register browser_list tool
  pi.registerTool({
    name: "browser_list",
    label: "Browser List",
    description: `List all open browser tabs with their IDs, URLs, and titles.

WHEN TO USE:
- To discover available browser tabs
- To get target IDs for other browser tools
- To check if browser remote debugging is enabled

Returns an array of tabs with:
- id: Target ID for use with other tools
- url: Current page URL
- title: Page title
- active: Whether this is the active tab

Prerequisites:
- Browser must have remote debugging enabled
- Chrome/Edge: Open chrome://inspect/#remote-debugging and toggle the switch
- Brave: Open brave://inspect/#remote-debugging and toggle the switch
- Auto-discovers Chrome, Brave, Edge, Chromium, Vivaldi on macOS/Linux/Windows`,

    parameters: Type.Object({}), // No parameters

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const tabs = await browser_list();

        return {
          content: [{
            type: "text",
            text: tabs.length === 0
              ? "No browser with remote debugging found. Enable remote debugging:\n- Chrome/Edge: open chrome://inspect/#remote-debugging\n- Brave: open brave://inspect/#remote-debugging\nThen toggle the switch to enable debugging."
              : `Found ${tabs.length} tab(s):\n\n` +
                tabs.map(t => `[${t.id}] ${t.title}\n    URL: ${t.url}${t.active ? ' (active)' : ''}`).join('\n')
          }],
          details: { tabs }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_snap tool
  pi.registerTool({
    name: "browser_snap",
    label: "Browser Snap",
    description: `Capture the accessibility tree of a browser page.

WHEN TO USE:
- To see interactive elements on a page (buttons, links, inputs)
- To find element names and roles for interaction
- To generate selector hints for browser_click
- To understand page structure without screenshots

Compact Mode (default):
Shows only interactive elements in format:
  [button] "Submit" (#submit-btn)
  [link] "About us" (a[href="/about"])
  [textbox] "Email" (#email)

Full Mode:
Shows complete accessibility tree with all nodes and properties.

Use this before browser_click to identify what to click.`,

    parameters: Type.Object({
      target: Type.String({
        description: "Target ID of the browser tab (from browser_list)"
      }),
      compact: Type.Optional(Type.Boolean({
        default: true,
        description: "Compact mode: show only interactive elements (button, link, input, etc.)"
      }))
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: "Capturing accessibility tree..." }],
          details: { stage: "capturing" }
        });

        const result = await browser_snap({
          target: params.target,
          compact: params.compact ?? true
        });

        const elementCount = result.interactiveElements.length;

        return {
          content: [{
            type: "text",
            text: params.compact !== false
              ? `Found ${elementCount} interactive element(s):\n\n${result.tree}`
              : `Accessibility tree:\n\n${result.tree}`
          }],
          details: {
            elementCount,
            interactiveElements: result.interactiveElements
          }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to capture accessibility tree: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_navigate tool
  pi.registerTool({
    name: "browser_navigate",
    label: "Browser Navigate",
    description: `Navigate to a URL in a browser tab.

WHEN TO USE:
- To load a new web page
- To navigate to a different URL in an existing tab
- To reload the current page (use current URL)

Wait Conditions:
- 'load': Wait for window.onload event (default)
- 'domcontentloaded': Wait for DOMContentLoaded event (faster)
- 'networkidle': Wait for 500ms of no network activity (slowest, most thorough)

Use 'domcontentloaded' for faster navigation when you don't need all resources.
Use 'networkidle' when you need to wait for all API calls to complete.`,

    parameters: Type.Object({
      target: Type.String({
        description: "Target ID of the browser tab (from browser_list)"
      }),
      url: Type.String({
        description: "URL to navigate to"
      }),
      waitFor: Type.Optional(Type.Union([
        Type.Literal('load'),
        Type.Literal('networkidle'),
        Type.Literal('domcontentloaded')
      ], {
        default: 'load',
        description: "When to consider navigation complete"
      }))
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: `Navigating to ${params.url}...` }],
          details: { stage: "navigating" }
        });

        const result = await browser_navigate({
          target: params.target,
          url: params.url,
          waitFor: params.waitFor || 'load'
        });

        return {
          content: [{
            type: "text",
            text: `Navigation complete.\n` +
              `URL: ${result.url}\n` +
              `Title: ${result.title}`
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_shot tool
  pi.registerTool({
    name: "browser_shot",
    label: "Browser Screenshot",
    description: `Capture a screenshot of a browser tab and save it to a file.

WHEN TO USE:
- To visually inspect the current state of a web page
- To verify UI changes after interactions
- To debug layout or rendering issues
- When you need to see what a user would see

The screenshot is saved as a PNG file. The tool returns metadata including:
- Path to the saved screenshot file
- Image dimensions in pixels
- Device Pixel Ratio (DPR) for coordinate conversion
- CSS viewport dimensions (logical pixels)

Coordinate Mapping:
- Screenshot pixels are at native resolution (CSS pixels × DPR)
- For CDP Input events (clickxy, etc.), use CSS pixels
- Formula: CSS pixels = Screenshot pixels ÷ DPR`,

    parameters: Type.Object({
      target: Type.String({
        description:
          "Target ID of the browser tab to screenshot (from browser_list)",
      }),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const result = await browser_shot({ target: params.target });

        // Update with screenshot image
        onUpdate?.({
          content: [
            {
              type: "image",
              data: await getImageData(result.path),
              mimeType: "image/png",
            },
          ],
          details: { stage: "screenshot_captured" },
        });

        return {
          content: [
            {
              type: "text",
              text: `Screenshot saved to: ${result.path}\n` +
                `Dimensions: ${result.width}x${result.height} pixels\n` +
                `CSS Viewport: ${result.cssWidth}x${result.cssHeight} logical pixels\n` +
                `DPR (Device Pixel Ratio): ${result.dpr}\n` +
                `\nCoordinate mapping: Divide screenshot pixels by ${result.dpr} to get CSS pixels for input events.`,
            },
          ],
          details: {
            path: result.path,
            width: result.width,
            height: result.height,
            dpr: result.dpr,
            cssWidth: result.cssWidth,
            cssHeight: result.cssHeight,
            render: screenshotRenderer(result),
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });

  // Register browser_html tool
  pi.registerTool({
    name: "browser_html",
    label: "Browser HTML",
    description: `Get the HTML content of a browser page or a specific element.

WHEN TO USE:
- To inspect the DOM structure of a page
- To extract specific element HTML for analysis
- To verify element presence or content

Returns the outerHTML of the full document or a specific element matching the selector.`,

    parameters: Type.Object({
      target: Type.String({
        description:
          "Target ID of the browser tab (from browser_list)",
      }),
      selector: Type.Optional(
        Type.String({
          description: "Optional CSS selector to get specific element HTML. If omitted, returns full document HTML.",
        }),
      ),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const result = await browser_html({
          target: params.target,
          selector: params.selector,
        });

        return {
          content: [
            {
              type: "text",
              text: result.html,
            },
          ],
          details: {
            length: result.length,
            truncated: result.truncated,
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get HTML: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });

  // Register browser_network tool
  pi.registerTool({
    name: "browser_network",
    label: "Browser Network",
    description: `Enable or disable network traffic capture for a browser tab.

WHEN TO USE:
- To monitor HTTP requests and responses during page navigation
- To debug API calls and network errors
- To capture network traffic for HAR export

The captured network data can be exported as a HAR file using browser_network_export.`,

    parameters: Type.Object({
      target: Type.String({
        description: "Target ID of the browser tab (from browser_list)",
      }),
      enable: Type.Boolean({
        description: "Enable or disable network capture",
      }),
      filter: Type.Optional(Type.Object({
        urlPattern: Type.Optional(Type.String({
          description: "Filter by URL pattern (glob pattern supported)",
        })),
        resourceTypes: Type.Optional(Type.Array(Type.String(), {
          description: "Filter by resource types (e.g., XHR, Fetch, Document, Script, Stylesheet, Image)",
        })),
      }, { description: "Optional filters for network capture" })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const result = await browser_network({
          target: params.target,
          enable: params.enable,
          filter: params.filter,
        });

        return {
          content: [
            {
              type: "text",
              text: `Network capture ${result.capturing ? "enabled" : "disabled"}.\n` +
                `Current requests in buffer: ${result.requestsCount}`,
            },
          ],
          details: {
            capturing: result.capturing,
            requestsCount: result.requestsCount,
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to ${params.enable ? "enable" : "disable"} network capture: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });

  // Register browser_network_export tool
  pi.registerTool({
    name: "browser_network_export",
    label: "Browser Network Export",
    description: `Export captured network traffic as a HAR (HTTP Archive) file.

WHEN TO USE:
- To save network traffic for later analysis
- To share network logs with developers
- To analyze API performance and timing
- To import into Chrome DevTools or other HAR analyzers

The HAR file follows the HAR v1.2 specification and includes:
- All captured requests and responses
- Timing information (DNS, connect, SSL, send, wait, receive)
- Summary statistics (total requests, failed requests, total size, total time)

Output is saved to ~/.cache/pi-browser/har/ by default.`,

    parameters: Type.Object({
      target: Type.Optional(Type.String({
        description: "Target ID of the browser tab (from browser_list). If omitted, uses most recently active tab.",
      })),
      path: Type.Optional(Type.String({
        description: "Custom output path for the HAR file. Default: ~/.cache/pi-browser/har/<timestamp>.har",
      })),
      includeContent: Type.Optional(Type.Boolean({
        default: true,
        description: "Include response content metadata in HAR (size, mimeType). Set to false to reduce file size.",
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        // Default to a placeholder target if not provided (tests will override)
        const targetId = params.target || "default";
        const result = await browser_network_export({
          target: targetId,
          path: params.path,
          includeContent: params.includeContent,
        });

        return {
          content: [
            {
              type: "text",
              text: `HAR file exported successfully.\n` +
                `Path: ${result.path}\n` +
                `Total entries: ${result.entryCount}\n` +
                `File size: ${result.size} bytes\n` +
                `\nSummary:\n` +
                `- Total requests: ${result.summary.totalRequests}\n` +
                `- Failed requests: ${result.summary.failedRequests}\n` +
                `- Total size: ${result.summary.totalSize} bytes\n` +
                `- Total time: ${result.summary.totalTime} ms`,
            },
          ],
          details: {
            path: result.path,
            entryCount: result.entryCount,
            size: result.size,
            summary: result.summary,
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to export HAR: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });

  // Register browser_console tool
  pi.registerTool({
    name: "browser_console",
    label: "Browser Console",
    description: `Enable or disable console message capture for a browser tab.

WHEN TO USE:
- To monitor JavaScript console output (console.log, console.error, etc.)
- To capture browser errors and warnings
- To debug JavaScript issues
- To track CSP violations and network errors

Captures both Runtime.consoleAPICalled (JS console calls) and Log.entryAdded (browser errors) events.`,

    parameters: Type.Object({
      target: Type.String({
        description: "Target ID of the browser tab (from browser_list)",
      }),
      enable: Type.Boolean({
        description: "Enable or disable console capture",
      }),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const result = await browser_console({
          target: params.target,
          enable: params.enable,
        });

        return {
          content: [
            {
              type: "text",
              text: `Console capture ${result.capturing ? "enabled" : "disabled"}.\n` +
                `Current entries in buffer: ${result.entriesCount}`,
            },
          ],
          details: {
            capturing: result.capturing,
            entriesCount: result.entriesCount,
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to ${params.enable ? "enable" : "disable"} console capture: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });

  // Register browser_cdp tool
  pi.registerTool({
    name: "browser_cdp",
    label: "Browser CDP",
    description: `Execute raw Chrome DevTools Protocol (CDP) commands for advanced browser control.

WHEN TO USE:
- When you need functionality not exposed through other tools
- For advanced debugging and profiling (Runtime, Profiler, HeapProfiler)
- To access browser internals (Memory, Performance metrics)
- For custom automation scripts
- To print PDFs, get heap usage, or access other Chrome features

All 644 CDP methods are available. Common examples:
- Runtime.evaluate: Execute JavaScript
- Runtime.getHeapUsage: Get heap memory stats
- Performance.getMetrics: Get performance metrics
- Page.printToPDF: Generate PDF
- DOM.querySelector: Query DOM nodes
- Network.getCookies: Get cookies

See https://chromedevtools.github.io/devtools-protocol/ for full method list.`,

    parameters: Type.Object({
      target: Type.String({
        description: "Target ID of the browser tab (from browser_list)",
      }),
      method: Type.String({
        description: 'CDP method name in format "Domain.method" (e.g., "Runtime.evaluate", "Page.printToPDF")',
      }),
      params: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
        description: "Optional parameters for the CDP method",
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const result = await browser_cdp({
          target: params.target,
          method: params.method,
          params: params.params || {},
        });

        return {
          content: [
            {
              type: "text",
              text: `CDP method "${params.method}" executed successfully.\n\nResult:\n${JSON.stringify(result.result, null, 2)}`,
            },
          ],
          details: {
            method: params.method,
            result: result.result,
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `CDP method "${params.method}" failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });

  // Register browser_set_headers tool
  pi.registerTool({
    name: "browser_set_headers",
    label: "Browser Set Headers",
    description: `Set custom HTTP headers for all subsequent requests in a browser tab.

WHEN TO USE:
- To add authentication headers (Authorization, X-API-Key)
- To set custom User-Agent strings
- To add request tracking headers
- To test API endpoints with specific headers

Headers are merged with existing ones (new values override duplicates).
Use clearOnNavigate to automatically clear headers on next navigation.

Note: Headers persist until explicitly cleared or tab closes.`,

    parameters: Type.Object({
      target: Type.String({
        description: "Target ID of the browser tab (from browser_list)",
      }),
      headers: Type.Record(Type.String(), Type.String(), {
        description: "HTTP headers to set (e.g., { 'Authorization': 'Bearer token' })",
      }),
      clearOnNavigate: Type.Optional(Type.Boolean({
        description: "Clear headers on next navigation",
        default: false,
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const result = await browser_set_headers({
          target: params.target,
          headers: params.headers,
          clearOnNavigate: params.clearOnNavigate ?? false,
        });

        const headerCount = Object.keys(result.activeHeaders).length;

        return {
          content: [
            {
              type: "text",
              text: `Custom headers set successfully.\n` +
                `Active headers: ${headerCount}\n` +
                `\nCurrent headers:\n` +
                Object.entries(result.activeHeaders)
                  .map(([k, v]) => `- ${k}: ${v.substring(0, 50)}${v.length > 50 ? '...' : ''}`)
                  .join("\n"),
            },
          ],
          details: {
            activeHeaders: result.activeHeaders,
            headerCount,
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to set headers: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });

  // Register browser_storage tool
  pi.registerTool({
    name: "browser_storage",
    label: "Browser Storage",
    description: `Manage browser storage including cookies and localStorage.

WHEN TO USE:
- To read, set, or delete cookies
- To access or modify localStorage data
- To clear storage data for debugging or testing

Actions:
- getCookies: Retrieve all cookies or filter by URL
- setCookie: Create or update a cookie
- deleteCookies: Remove cookies by name (optionally URL-specific)
- getLocalStorage: Get all localStorage entries
- setLocalStorage: Set a localStorage key-value pair
- clearStorage: Clear cookies, local_storage, and/or session_storage`,

    parameters: BrowserStorageSchema,

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const result = await browser_storage({
          target: params.target,
          action: params.action,
          name: params.name,
          value: params.value,
          domain: params.domain,
          path: params.path,
          httpOnly: params.httpOnly,
          secure: params.secure,
          sameSite: params.sameSite,
          url: params.url,
          key: params.key,
          types: params.types,
        });

        // Build response text based on action
        let text = "";
        if (result.cookies) {
          text = `Retrieved ${result.cookies.length} cookies.`;
        } else if (result.localStorage) {
          const entries = Object.entries(result.localStorage);
          text = `Retrieved ${entries.length} localStorage entries.`;
        } else if (result.success) {
          text = `Storage operation '${params.action}' completed successfully.`;
        }

        return {
          content: [{ type: "text", text }],
          details: result,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Storage operation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });

  // Register browser_tab_open tool
  pi.registerTool({
    name: "browser_tab_open",
    label: "Browser Tab Open",
    description: `Open a new browser tab and optionally navigate to a URL.

WHEN TO USE:
- To open a new tab
- To open a new tab and navigate to a URL

Returns:
- tabId: The new tab's target ID
- url: The tab's URL
- active: Whether the tab is active`,

    parameters: Type.Object({
      url: Type.Optional(Type.String({
        description: "Optional URL to navigate to in the new tab"
      })),
      activate: Type.Optional(Type.Boolean({
        default: true,
        description: "Whether to activate the new tab (focus it)"
      })),
      windowId: Type.Optional(Type.String({
        description: "Optional window ID to open the tab in"
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: "Opening new tab..." }],
          details: { stage: "opening" }
        });

        const result = await browser_tab_open({
          url: params.url,
          activate: params.activate ?? true,
          windowId: params.windowId,
        });

        return {
          content: [{
            type: "text",
            text: `Tab opened successfully.\n` +
              `Tab ID: ${result.tabId}\n` +
              `URL: ${result.url}\n` +
              `Active: ${result.active}`
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to open tab: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_tab_switch tool
  pi.registerTool({
    name: "browser_tab_switch",
    label: "Browser Tab Switch",
    description: `Switch to a different browser tab by activating it.

WHEN TO USE:
- To switch context to another tab
- To make a different tab active for subsequent operations`,

    parameters: Type.Object({
      tabId: Type.String({
        description: "Target ID of the tab to switch to (from browser_list)"
      }),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: `Switching to tab ${params.tabId}...` }],
          details: { stage: "switching" }
        });

        const result = await browser_tab_switch({
          tabId: params.tabId,
        });

        return {
          content: [{
            type: "text",
            text: `Switched to tab ${result.newTab.id}.\n` +
              `URL: ${result.newTab.url}\n` +
              `Title: ${result.newTab.title}`
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to switch tab: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_tab_close tool
  pi.registerTool({
    name: "browser_tab_close",
    label: "Browser Tab Close",
    description: `Close a browser tab and cleanup its resources.

WHEN TO USE:
- To close a specific tab
- To close the current tab

By default, cannot close the last tab. Use allowQuit=true to close the last tab anyway.`,

    parameters: Type.Object({
      tabId: Type.Optional(Type.String({
        description: "Target ID of the tab to close. If omitted, closes the active tab"
      })),
      allowQuit: Type.Optional(Type.Boolean({
        default: false,
        description: "Allow closing the last tab (will quit browser if only one tab)"
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: "Closing tab..." }],
          details: { stage: "closing" }
        });

        const result = await browser_tab_close({
          tabId: params.tabId,
          allowQuit: params.allowQuit ?? false,
        });

        return {
          content: [{
            type: "text",
            text: `Tab closed successfully.` +
              (result.newActiveTab ? `\nNew active tab: ${result.newActiveTab}` : "")
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to close tab: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_wait tool
  pi.registerTool({
    name: "browser_wait",
    label: "Browser Wait",
    description: `Wait for various conditions with configurable timeout.

WHEN TO USE:
- element: Wait for a DOM element to appear
- network: Wait for network idle (no activity for 500ms)
- navigation: Wait for page navigation to complete
- time: Wait for a specified duration
- function: Wait for a JavaScript expression to return truthy

Wait Types:
- element: Polls DOM with exponential backoff until element appears
- network: Listens for network activity, waits for quiet period
- navigation: Waits for Page.loadEventFired CDP event
- time: Simple sleep for specified duration
- function: Polls Runtime.evaluate until expression returns truthy`,

    parameters: Type.Object({
      target: Type.String({
        description: "Target ID of the browser tab (from browser_list)"
      }),
      type: Type.Union([
        Type.Literal('element'),
        Type.Literal('network'),
        Type.Literal('navigation'),
        Type.Literal('time'),
        Type.Literal('function')
      ], {
        description: "Type of wait condition"
      }),
      selector: Type.Optional(Type.String({
        description: "CSS selector (required for 'element' wait type)"
      })),
      expression: Type.Optional(Type.String({
        description: "JavaScript expression (required for 'function' wait type)"
      })),
      timeout: Type.Optional(Type.Number({
        default: 30000,
        description: "Maximum wait time in milliseconds"
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: `Waiting for ${params.type}...` }],
          details: { stage: "waiting", type: params.type }
        });

        const result = await browser_wait({
          target: params.target,
          type: params.type,
          selector: params.selector,
          expression: params.expression,
          timeout: params.timeout ?? 30000,
        });

        return {
          content: [{
            type: "text",
            text: result.success
              ? `Wait successful. Waited ${result.waitedMs}ms.`
              : `Wait failed after ${result.waitedMs}ms.`
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Wait failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_find tool
  pi.registerTool({
    name: "browser_find",
    label: "Browser Find",
    description: `Find elements on the page using semantic criteria (accessibility tree).

WHEN TO USE:
- To find elements by ARIA role (button, link, textbox, heading)
- To find elements by accessible name (visible text)
- To find elements by heading level (h1-h6)

Returns matching elements with:
- role: ARIA role
- name: Accessible name
- selector: Best-effort CSS selector
- x, y, width, height: Element coordinates for clicking`,

    parameters: Type.Object({
      target: Type.String({
        description: "Target ID of the browser tab (from browser_list)"
      }),
      role: Type.Optional(Type.String({
        description: "ARIA role to filter by (e.g., 'button', 'link', 'textbox', 'heading')"
      })),
      name: Type.Optional(Type.String({
        description: "Accessible name to filter by (substring match, case-insensitive)"
      })),
      level: Type.Optional(Type.Number({
        description: "Heading level 1-6 (only used when role='heading')"
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: "Finding elements..." }],
          details: { stage: "finding" }
        });

        const result = await browser_find({
          target: params.target,
          role: params.role,
          name: params.name,
          level: params.level,
        });

        if (!result.found || result.elements.length === 0) {
          return {
            content: [{ type: "text", text: "No elements found matching the criteria." }],
            details: result
          };
        }

        const elementText = result.elements.map((el, i) =>
          `[${i + 1}] ${el.role}${el.name ? ` "${el.name}"` : ''}\n` +
          `    Selector: ${el.selector || 'N/A'}\n` +
          `    Coordinates: (${el.x}, ${el.y}, ${el.width}x${el.height})`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `Found ${result.elements.length} element(s):\n\n${elementText}`
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Find failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_emulate tool
  pi.registerTool({
    name: "browser_emulate",
    label: "Browser Emulate",
    description: `Emulate a device in the browser by setting viewport, user agent, and touch.

WHEN TO USE:
- To test responsive designs
- To emulate mobile devices
- To set custom viewport dimensions
- To override user agent

Device Presets:
- iPhone14Pro, iPhone14ProMax, iPhone13
- Pixel7, Pixel7Pro, SamsungS23
- iPad, iPadPro, iPadMini
- Desktop, DesktopHD, Desktop4K
- MacBookAir, MacBookPro14, MacBookPro16

Use clear=true to reset all emulation to defaults.`,

    parameters: Type.Object({
      target: Type.Optional(Type.String({
        description: "Target ID of the browser tab (from browser_list). If omitted, uses default tab."
      })),
      device: Type.Optional(Type.Union([
        Type.Literal('iPhone14Pro'),
        Type.Literal('iPhone14ProMax'),
        Type.Literal('iPhone13'),
        Type.Literal('Pixel7'),
        Type.Literal('Pixel7Pro'),
        Type.Literal('SamsungS23'),
        Type.Literal('iPad'),
        Type.Literal('iPadPro'),
        Type.Literal('iPadMini'),
        Type.Literal('Desktop'),
        Type.Literal('DesktopHD'),
        Type.Literal('Desktop4K'),
        Type.Literal('MacBookAir'),
        Type.Literal('MacBookPro14'),
        Type.Literal('MacBookPro16'),
      ], {
        description: "Device preset to emulate"
      })),
      width: Type.Optional(Type.Number({
        description: "Viewport width in pixels (overrides preset)"
      })),
      height: Type.Optional(Type.Number({
        description: "Viewport height in pixels (overrides preset)"
      })),
      dpr: Type.Optional(Type.Number({
        description: "Device pixel ratio (overrides preset)"
      })),
      mobile: Type.Optional(Type.Boolean({
        description: "Mobile mode flag (overrides preset)"
      })),
      touch: Type.Optional(Type.Boolean({
        description: "Touch emulation enabled (overrides preset)"
      })),
      userAgent: Type.Optional(Type.String({
        description: "Custom user agent string (overrides preset)"
      })),
      clear: Type.Optional(Type.Boolean({
        default: false,
        description: "Clear all emulation and reset to defaults"
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: params.clear ? "Clearing emulation..." : "Applying device emulation..." }],
          details: { stage: params.clear ? "clearing" : "emulating" }
        });

        const result = await browser_emulate({
          target: params.target,
          device: params.device,
          width: params.width,
          height: params.height,
          dpr: params.dpr,
          mobile: params.mobile,
          touch: params.touch,
          userAgent: params.userAgent,
          clear: params.clear ?? false,
        });

        if (result.cleared) {
          return {
            content: [{
              type: "text",
              text: "Emulation cleared. Reset to default viewport (1280x720)."
            }],
            details: result
          };
        }

        return {
          content: [{
            type: "text",
            text: `Device emulation applied:\n` +
              `Viewport: ${result.applied.width}x${result.applied.height}\n` +
              `DPR: ${result.applied.dpr}\n` +
              `Mobile: ${result.applied.mobile}\n` +
              `Touch: ${result.applied.touch}` +
              (result.applied.userAgent ? `\nUser Agent: ${result.applied.userAgent.substring(0, 50)}...` : "")
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Emulation failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_diagnose tool
  pi.registerTool({
    name: "browser_diagnose",
    label: "Browser Diagnose",
    description: `Diagnose browser mutex locks and identify potential deadlock issues.

WHEN TO USE:
- When browser operations are timing out with "Tab busy" errors
- To check for stale locks from crashed operations
- To see which operations are holding mutex locks
- Before calling browser_mutex_cleanup to see what will be cleaned

Reports:
- Tab ID with the lock
- Holder process ID (PID)
- Whether holder is alive or dead
- Is it from our current session
- Lock age in milliseconds
- Operation that acquired the lock`,

    parameters: Type.Object({}), // No parameters

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const locks = await diagnoseLocks();

        if (locks.length === 0) {
          return {
            content: [{ type: "text", text: "No mutex locks held. System is healthy." }],
            details: { locks: [] }
          };
        }

        const summary = locks.map(l =>
          `[${l.tabId}] PID ${l.holderPid} (${l.holderAlive ? 'alive' : 'DEAD'})${l.isOurSession ? ' [our session]' : ''} - "${l.operation}" (${(l.ageMs / 1000).toFixed(1)}s old)`
        ).join('\n');

        const staleCount = locks.filter(l => !l.holderAlive || l.ageMs > 300000).length;

        return {
          content: [{
            type: "text",
            text: `${locks.length} mutex lock(s) held:\n\n${summary}\n\n` +
              (staleCount > 0 ? `${staleCount} potentially stale lock(s) detected. Use browser_mutex_cleanup to clean them.` : "All locks appear healthy.")
          }],
          details: { locks, staleCount }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Diagnosis failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });

  // Register browser_mutex_cleanup tool
  pi.registerTool({
    name: "browser_mutex_cleanup",
    label: "Browser Mutex Cleanup",
    description: `Clean up stale mutex locks from crashed operations.

WHEN TO USE:
- After a crash left mutex locks behind
- When browser_diagnose reports dead holder processes
- To force-release a stuck lock (use with caution)

WARNING:
- Cleaning live locks may interfere with concurrent operations
- Use 'ourSessionOnly' for safest cleanup of your own crashed processes
- 'force=true' will kill live processes - very dangerous!

Cleanup options:
- ourSessionOnly: Only clean locks from our crashed session (safest)
- maxAgeMs: Clean locks older than specified milliseconds
- force: Kill live processes and clean their locks (DANGEROUS)`,

    parameters: Type.Object({
      ourSessionOnly: Type.Optional(Type.Boolean({
        default: true,
        description: "Only clean locks from our crashed session (safest option)"
      })),
      maxAgeMs: Type.Optional(Type.Number({
        description: "Clean locks older than this many milliseconds (e.g., 300000 for 5 minutes)"
      })),
      force: Type.Optional(Type.Boolean({
        default: false,
        description: "DANGEROUS: Kill live processes and clean their locks"
      })),
    }),

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({
          content: [{ type: "text", text: "Cleaning up stale mutex locks..." }],
          details: { stage: "cleaning" }
        });

        const cleaned = await cleanupStaleLocks({
          ourSessionOnly: params.ourSessionOnly ?? true,
          maxAgeMs: params.maxAgeMs,
          force: params.force ?? false,
        });

        if (cleaned.length === 0) {
          return {
            content: [{ type: "text", text: "No stale locks found matching criteria." }],
            details: { cleaned: [] }
          };
        }

        return {
          content: [{
            type: "text",
            text: `Cleaned ${cleaned.length} stale mutex lock(s):\n` +
              cleaned.map(id => `  - ${id}`).join('\n')
          }],
          details: { cleaned }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          details: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }
  });
}

async function getImageData(filepath: string): Promise<string> {
  const { promises: fs } = await import("node:fs");
  const buffer = await fs.readFile(filepath);
  return buffer.toString("base64");
}
