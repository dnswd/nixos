import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { browser_shot, browser_html } from "./core/tools-page.js";
import { browser_network, browser_network_export, browser_cdp, browser_set_headers } from "./core/tools-network.js";
import { browser_console } from "./core/tools-console.js";
import { browser_storage, BrowserStorageSchema } from "./core/tools-storage.js";
import { browser_list, browser_navigate, browser_snap } from "./core/tools-nav.js";
import { screenshotRenderer } from "./renderers.js";

export default function (pi: ExtensionAPI) {
  // Register browser_list tool
  pi.registerTool({
    name: "browser_list",
    label: "Browser List",
    description: `List all open Chrome tabs with their IDs, URLs, and titles.

WHEN TO USE:
- To discover available browser tabs
- To get target IDs for other browser tools
- To check if Chrome is running with remote debugging enabled

Returns an array of tabs with:
- id: Target ID for use with other tools
- url: Current page URL
- title: Page title
- active: Whether this is the active tab

Note: Chrome must be running with --remote-debugging-port=9222`,

    parameters: Type.Object({}), // No parameters

    async execute(toolCallId, params, signal, onUpdate) {
      try {
        const tabs = await browser_list();

        return {
          content: [{
            type: "text",
            text: tabs.length === 0
              ? "No browser tabs found. Make sure Chrome is running with --remote-debugging-port=9222"
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
}

async function getImageData(filepath: string): Promise<string> {
  const { promises: fs } = await import("node:fs");
  const buffer = await fs.readFile(filepath);
  return buffer.toString("base64");
}
