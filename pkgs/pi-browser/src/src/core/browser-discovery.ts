/**
 * Browser auto-discovery for pi-browser
 * Finds Chrome, Brave, Edge, Chromium, Vivaldi via DevToolsActivePort files
 */

import { homedir } from "os";

/**
 * Auto-discover browser WebSocket URL by searching for DevToolsActivePort files.
 * Checks Chrome, Brave, Edge, Chromium, Vivaldi on macOS/Linux/Windows.
 * Supports Flatpak installations.
 *
 * @returns WebSocket URL for browser's DevTools protocol
 * @throws Error if no DevToolsActivePort found
 */
export async function getBrowserWsUrl(): Promise<string> {
  const home = homedir();
  const platform = process.platform;

  // macOS browser paths
  const macBrowsers = [
    "Google/Chrome",
    "Google/Chrome Beta",
    "Google/Chrome for Testing",
    "Chromium",
    "BraveSoftware/Brave-Browser",
    "Microsoft Edge",
  ];

  // Linux browser paths
  const linuxBrowsers = [
    "google-chrome",
    "google-chrome-beta",
    "chromium",
    "vivaldi",
    "vivaldi-snapshot",
    "BraveSoftware/Brave-Browser",
    "microsoft-edge",
  ];

  // Flatpak browser paths: [appId, configName]
  const flatpakBrowsers: [string, string][] = [
    ["org.chromium.Chromium", "chromium"],
    ["com.google.Chrome", "google-chrome"],
    ["com.brave.Browser", "BraveSoftware/Brave-Browser"],
    ["com.microsoft.Edge", "microsoft-edge"],
    ["com.vivaldi.Vivaldi", "vivaldi"],
  ];

  // Build candidate paths based on platform
  const candidates: string[] = [];

  // Environment variable override (direct WS URL)
  if (process.env.CDP_WS_URL) {
    return process.env.CDP_WS_URL;
  }

  // Environment variable pointing to port file
  if (process.env.CDP_PORT_FILE && process.env.CDP_PORT_FILE.endsWith("DevToolsActivePort")) {
    candidates.push(process.env.CDP_PORT_FILE);
  }

  if (platform === "darwin") {
    // macOS paths
    for (const b of macBrowsers) {
      candidates.push(
        `${home}/Library/Application Support/${b}/DevToolsActivePort`,
        `${home}/Library/Application Support/${b}/Default/DevToolsActivePort`,
      );
    }
  } else if (platform === "linux") {
    // Linux paths
    for (const b of linuxBrowsers) {
      candidates.push(
        `${home}/.config/${b}/DevToolsActivePort`,
        `${home}/.config/${b}/Default/DevToolsActivePort`,
      );
    }
    // Flatpak paths
    for (const [appId, name] of flatpakBrowsers) {
      candidates.push(
        `${home}/.var/app/${appId}/config/${name}/DevToolsActivePort`,
        `${home}/.var/app/${appId}/config/${name}/Default/DevToolsActivePort`,
      );
    }
  } else if (platform === "win32") {
    // Windows paths
    const localAppData = process.env.LOCALAPPDATA || `${home}/AppData/Local`;
    for (const b of ["Google/Chrome", "BraveSoftware/Brave-Browser", "Microsoft/Edge"]) {
      candidates.push(
        `${localAppData}/${b}/User Data/DevToolsActivePort`,
        `${localAppData}/${b}/User Data/Default/DevToolsActivePort`,
      );
    }
  }

  // Try each candidate path
  for (const candidate of candidates) {
    try {
      const fs = await import("fs");
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, "utf8").trim();
        const lines = content.split("\n");
        // DevToolsActivePort format: port on first line, path on second line
        if (lines.length >= 2 && lines[0] && lines[1]) {
          const port = lines[0].trim();
          const path = lines[1].trim();
          if (port && path) {
            const host = process.env.CDP_HOST || "127.0.0.1";
            return `ws://${host}:${port}${path}`;
          }
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error(
    "No DevToolsActivePort found. Enable remote debugging:\n" +
    "- Chrome/Edge: open chrome://inspect/#remote-debugging\n" +
    "- Brave: open brave://inspect/#remote-debugging\n" +
    "Then toggle the switch to enable debugging.",
  );
}
