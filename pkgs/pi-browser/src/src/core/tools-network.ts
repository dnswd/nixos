import { getCDPClient, closePersistentConnection, hasPersistentConnection } from "./cdp-client.js";
import { promises as fs } from "fs";
import { dirname } from "path";
import { homedir } from "os";
import { join } from "path";

// ============================================================================
// CDP Tool Types
// ============================================================================

export interface CDPResult {
  result: unknown;
}

// Valid CDP domains for validation
const VALID_CDP_DOMAINS = [
  "Accessibility", "Audits", "Browser", "CSS", "CacheStorage", "Cast", "Console",
  "DOM", "DOMDebugger", "DOMSnapshot", "Debugger", "DeviceOrientation",
  "Emulation", "EventBreakpoints", "Fetch", "HeadlessExperimental", "HeapProfiler",
  "IO", "Inspector", "LayerTree", "Log", "Media", "Memory", "Network", "Overlay",
  "Page", "Performance", "PerformanceTimeline", "Profiler", "Runtime", "Schema",
  "Security", "ServiceWorker", "Storage", "SystemInfo", "Target", "Tethering",
  "Tracing", "WebAudio", "WebAuthn",
] as const;

// ============================================================================
// Network Entry Types
// ============================================================================

export interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
}

export interface NetworkResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  encodedDataLength?: number;
  timestamp: number;
  timing?: {
    requestTime: number;
    proxyStart?: number;
    proxyEnd?: number;
    dnsStart?: number;
    dnsEnd?: number;
    connectStart?: number;
    connectEnd?: number;
    sslStart?: number;
    sslEnd?: number;
    sendStart: number;
    sendEnd: number;
    receiveHeadersEnd: number;
  };
}

export interface NetworkEntry {
  requestId: string;
  request: NetworkRequest;
  response?: NetworkResponse;
  responseBody?: string;
  fromCache: boolean;
}

// ============================================================================
// Buffer Management
// ============================================================================

// Per-tab network buffer: Map<targetId, Map<requestId, NetworkEntry>>
const networkBuffers = new Map<string, Map<string, NetworkEntry>>();
const captureState = new Map<string, boolean>();

// Configuration
const MAX_REQUESTS_PER_TAB = 1000;
const MAX_TOTAL_MEMORY_MB = 50;

// Calculate total memory used across all buffers (approximate)
function calculateMemoryUsage(): number {
  let totalBytes = 0;
  for (const buffer of networkBuffers.values()) {
    for (const entry of buffer.values()) {
      // Approximate size calculation
      totalBytes += JSON.stringify(entry).length * 2; // UTF-16 estimate
    }
  }
  return totalBytes / (1024 * 1024); // Convert to MB
}

/**
 * Get or create the network buffer for a target
 */
export function getNetworkBuffer(targetId: string): Map<string, NetworkEntry> {
  if (!networkBuffers.has(targetId)) {
    networkBuffers.set(targetId, new Map());
  }
  return networkBuffers.get(targetId)!;
}

/**
 * Add a network request to the buffer
 */
export function addNetworkRequest(
  targetId: string,
  requestData: {
    requestId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
    timestamp: number;
  }
): void {
  const buffer = getNetworkBuffer(targetId);

  buffer.set(requestData.requestId, {
    requestId: requestData.requestId,
    request: {
      url: requestData.url,
      method: requestData.method,
      headers: requestData.headers,
      postData: requestData.postData,
      timestamp: requestData.timestamp,
    },
    fromCache: false,
  });
}

/**
 * Add a network response to the buffer (correlates with existing request)
 */
export function addNetworkResponse(
  targetId: string,
  responseData: {
    requestId: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    encodedDataLength?: number;
    timestamp: number;
    timing?: NetworkResponse["timing"];
  }
): void {
  const buffer = getNetworkBuffer(targetId);
  const entry = buffer.get(responseData.requestId);

  if (entry) {
    // Update existing entry with response
    entry.response = {
      status: responseData.status,
      statusText: responseData.statusText,
      headers: responseData.headers,
      mimeType: responseData.mimeType,
      encodedDataLength: responseData.encodedDataLength,
      timestamp: responseData.timestamp,
      timing: responseData.timing,
    };
  } else {
    // Create orphaned response entry (no matching request)
    buffer.set(responseData.requestId, {
      requestId: responseData.requestId,
      request: undefined as unknown as NetworkRequest,
      response: {
        status: responseData.status,
        statusText: responseData.statusText,
        headers: responseData.headers,
        mimeType: responseData.mimeType,
        encodedDataLength: responseData.encodedDataLength,
        timestamp: responseData.timestamp,
        timing: responseData.timing,
      },
      fromCache: false,
    });
  }
}

/**
 * Clear the network buffer for a target
 */
export function clearNetworkBuffer(targetId: string): void {
  networkBuffers.delete(targetId);
}

/**
 * Get network entries as an array for a target
 */
export function getNetworkEntries(targetId: string): NetworkEntry[] {
  const buffer = networkBuffers.get(targetId);
  return buffer ? Array.from(buffer.values()) : [];
}

/**
 * Get the current size of the network buffer for a target
 */
export function getNetworkBufferSize(targetId: string): number {
  return networkBuffers.get(targetId)?.size ?? 0;
}

/**
 * Check if network capture is enabled for a target
 */
export function isCapturing(targetId: string): boolean {
  return captureState.get(targetId) ?? false;
}

// ============================================================================
// Response Body Handling
// ============================================================================

/**
 * Determine if we should fetch the response body based on content type
 */
function shouldFetchResponseBody(entry: NetworkEntry): boolean {
  const mimeType = entry.response?.mimeType || "";
  return mimeType.startsWith("text/") ||
         mimeType === "application/json" ||
         mimeType === "application/javascript" ||
         mimeType === "application/xml" ||
         mimeType === "application/xhtml+xml" ||
         mimeType.endsWith("+xml");
}

/**
 * Fetch the response body for a request
 */
async function fetchResponseBody(
  cdp: Awaited<ReturnType<typeof getCDPClient>>,
  requestId: string
): Promise<string | undefined> {
  try {
    const result = await cdp.send("Network.getResponseBody", { requestId }) as {
      body: string;
      base64Encoded: boolean;
    };
    
    if (result.base64Encoded) {
      return Buffer.from(result.body, "base64").toString("utf-8");
    }
    return result.body;
  } catch (e) {
    // Response body may not be available (e.g., for redirects or CORS)
    return undefined;
  }
}

// ============================================================================
// Network Event Handlers
// ============================================================================

interface RequestWillBeSentParams {
  requestId: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
  };
  timestamp: number;
  redirectResponse?: {
    fromDiskCache?: boolean;
  };
}

interface ResponseReceivedParams {
  requestId: string;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    encodedDataLength?: number;
    timing?: NetworkResponse["timing"];
  };
  timestamp: number;
}

interface LoadingFinishedParams {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}

/**
 * Set up network event listeners for a target
 */
async function setupNetworkListeners(
  targetId: string,
  cdp: Awaited<ReturnType<typeof getCDPClient>>
): Promise<void> {
  const buffer = getNetworkBuffer(targetId);

  // Network.requestWillBeSent - Store request info
  cdp.on("Network.requestWillBeSent", (params: unknown) => {
    const { requestId, request, timestamp, redirectResponse } = params as RequestWillBeSentParams;
    
    // Check memory limit
    const memoryUsageMB = calculateMemoryUsage();
    if (memoryUsageMB > MAX_TOTAL_MEMORY_MB) {
      console.warn(`Network buffer memory limit (${MAX_TOTAL_MEMORY_MB}MB) exceeded, skipping request`);
      return;
    }

    // Circular eviction: remove oldest if buffer size exceeded
    if (buffer.size >= MAX_REQUESTS_PER_TAB) {
      const oldestKey = buffer.keys().next().value;
      if (oldestKey) {
        buffer.delete(oldestKey);
      }
    }

    buffer.set(requestId, {
      requestId,
      request: {
        url: request.url,
        method: request.method,
        headers: request.headers,
        postData: request.postData,
        timestamp,
      },
      fromCache: redirectResponse?.fromDiskCache ?? false,
    });
  });

  // Network.responseReceived - Update with response info
  cdp.on("Network.responseReceived", (params: unknown) => {
    const { requestId, response, timestamp } = params as ResponseReceivedParams;
    const entry = buffer.get(requestId);
    
    if (entry) {
      entry.response = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        mimeType: response.mimeType,
        encodedDataLength: response.encodedDataLength,
        timestamp,
        timing: response.timing,
      };
    }
  });

  // Network.loadingFinished - Fetch response body for text-based content
  cdp.on("Network.loadingFinished", async (params: unknown) => {
    const { requestId } = params as LoadingFinishedParams;
    const entry = buffer.get(requestId);
    
    if (entry && shouldFetchResponseBody(entry)) {
      entry.responseBody = await fetchResponseBody(cdp, requestId) ?? undefined;
    }
  });

  captureState.set(targetId, true);
}

// ============================================================================
// Public API
// ============================================================================

export interface NetworkResult {
  capturing: boolean;
  requestsCount: number;
}

export interface NetworkFilter {
  urlPattern?: string;
  resourceTypes?: string[];
}

// ============================================================================
// HAR Export Types
// ============================================================================

interface HARHeader {
  name: string;
  value: string;
}

interface HARPostData {
  text?: string;
}

interface HARRequest {
  method: string;
  url: string;
  headers: HARHeader[];
  postData?: HARPostData;
}

interface HARContent {
  size: number;
  mimeType: string;
}

interface HARResponse {
  status: number;
  statusText: string;
  headers: HARHeader[];
  content?: HARContent;
  redirectURL: string;
}

interface HARTimings {
  dns: number;
  connect: number;
  ssl: number;
  send: number;
  wait: number;
  receive: number;
}

interface HARCache {
  beforeRequest: null;
  afterRequest: null;
}

interface HAREntry {
  pageref: string;
  startedDateTime: string;
  time: number;
  request: HARRequest;
  response: HARResponse;
  cache: HARCache;
  timings: HARTimings;
}

interface HARPage {
  id: string;
  startedDateTime: string;
  title: string;
  pageTimings: {
    onContentLoad: number;
    onLoad: number;
  };
}

interface HARLog {
  version: string;
  creator: {
    name: string;
    version: string;
  };
  pages: HARPage[];
  entries: HAREntry[];
}

interface HAR {
  log: HARLog;
}

export interface ExportResult {
  path: string;
  entryCount: number;
  size: number;
  summary: {
    totalRequests: number;
    failedRequests: number;
    totalSize: number;
    totalTime: number;
  };
}

/**
 * Get the page title for a target
 */
async function getPageTitle(targetId: string): Promise<string> {
  try {
    const cdp = await getCDPClient(targetId, false);
    const result = await cdp.send("Runtime.evaluate", { expression: "document.title" }) as {
      result?: { value?: string };
    };
    return result.result?.value || "Unknown";
  } catch {
    return "Unknown";
  }
}

/**
 * Generate default HAR output path
 */
function generateHARPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(homedir(), ".cache", "pi-browser", "har", `${timestamp}.har`);
}

/**
 * Calculate total time from timing data (in milliseconds)
 */
function calculateTotalTime(timing: NetworkResponse["timing"]): number {
  if (!timing) return 0;
  
  const dns = timing.dnsEnd && timing.dnsStart ? timing.dnsEnd - timing.dnsStart : 0;
  const connect = timing.connectEnd && timing.connectStart ? timing.connectEnd - timing.connectStart : 0;
  const ssl = timing.sslEnd && timing.sslStart ? timing.sslEnd - timing.sslStart : 0;
  const send = timing.sendEnd && timing.sendStart ? timing.sendEnd - timing.sendStart : 0;
  const wait = timing.receiveHeadersEnd && timing.sendEnd ? timing.receiveHeadersEnd - timing.sendEnd : 0;
  
  return (dns + connect + ssl + send + wait) * 1000; // Convert seconds to ms
}

/**
 * Convert a NetworkEntry to HAR entry format
 */
function convertToHAREntry(entry: NetworkEntry, includeContent: boolean): HAREntry {
  const timing = entry.response?.timing;
  
  return {
    pageref: "page_1",
    startedDateTime: new Date(entry.request.timestamp * 1000).toISOString(),
    time: calculateTotalTime(timing),
    request: {
      method: entry.request.method,
      url: entry.request.url,
      headers: Object.entries(entry.request.headers).map(([name, value]) => ({ name, value })),
      postData: entry.request.postData ? { text: entry.request.postData } : undefined,
    },
    response: {
      status: entry.response?.status || 0,
      statusText: entry.response?.statusText || "",
      headers: Object.entries(entry.response?.headers || {}).map(([name, value]) => ({ name, value })),
      content: includeContent ? {
        size: entry.response?.encodedDataLength || 0,
        mimeType: entry.response?.mimeType || "application/octet-stream",
      } : undefined,
      redirectURL: "",
    },
    cache: { beforeRequest: null, afterRequest: null },
    timings: {
      dns: timing?.dnsEnd && timing?.dnsStart ? (timing.dnsEnd - timing.dnsStart) * 1000 : -1,
      connect: timing?.connectEnd && timing?.connectStart ? (timing.connectEnd - timing.connectStart) * 1000 : -1,
      ssl: timing?.sslEnd && timing?.sslStart ? (timing.sslEnd - timing.sslStart) * 1000 : -1,
      send: timing?.sendEnd && timing?.sendStart ? (timing.sendEnd - timing.sendStart) * 1000 : -1,
      wait: timing?.receiveHeadersEnd && timing?.sendEnd ? (timing.receiveHeadersEnd - timing.sendEnd) * 1000 : -1,
      receive: timing ? (entry.response!.timestamp - timing.requestTime) * 1000 - timing.receiveHeadersEnd * 1000 : -1,
    },
  };
}

/**
 * Export captured network entries as HAR file
 */
export async function browser_network_export({
  target,
  path,
  includeContent = true,
}: {
  target: string;
  path?: string;
  includeContent?: boolean;
}): Promise<ExportResult> {
  const entries = getNetworkEntries(target);
  
  // Build HAR v1.2
  const har: HAR = {
    log: {
      version: "1.2",
      creator: { name: "pi-browser", version: "1.0.0" },
      pages: [{
        id: "page_1",
        startedDateTime: new Date(entries[0]?.request.timestamp * 1000 || Date.now()).toISOString(),
        title: await getPageTitle(target),
        pageTimings: { onContentLoad: -1, onLoad: -1 },
      }],
      entries: entries.map(e => convertToHAREntry(e, includeContent)),
    },
  };
  
  // Generate output path
  const outputPath = path || generateHARPath();
  await fs.mkdir(dirname(outputPath), { recursive: true });
  const harJson = JSON.stringify(har, null, 2);
  await fs.writeFile(outputPath, harJson);
  
  // Calculate summary
  const summary = {
    totalRequests: entries.length,
    failedRequests: entries.filter(e => e.response && e.response.status >= 400).length,
    totalSize: entries.reduce((sum, e) => sum + (e.response?.encodedDataLength || 0), 0),
    totalTime: Math.max(...entries.map(e => (e.response?.timing?.receiveHeadersEnd || 0) * 1000), 0),
  };
  
  return {
    path: outputPath,
    entryCount: entries.length,
    size: Buffer.byteLength(harJson),
    summary,
  };
}

/**
 * Enable or disable network capture for a browser tab
 */
export async function browser_network({
  target,
  enable,
  filter,
}: {
  target: string;
  enable: boolean;
  filter?: NetworkFilter;
}): Promise<NetworkResult> {
  if (enable) {
    // Clear buffer for fresh capture
    clearNetworkBuffer(target);

    // Get persistent connection for event listening
    const cdp = await getCDPClient(target, true);

    try {
      // Enable network domain
      await cdp.send("Network.enable");

      // Set up event listeners
      await setupNetworkListeners(target, cdp);

      // Set filter if provided
      if (filter?.urlPattern || filter?.resourceTypes) {
        const patterns =
          filter.resourceTypes?.map((type) => ({
            urlPattern: filter.urlPattern || "*",
            resourceType: type,
          })) || [{ urlPattern: filter.urlPattern || "*" }];

        await cdp.send("Network.setRequestInterception", { patterns });
      }

      return { capturing: true, requestsCount: 0 };
    } catch (error) {
      // Clean up on error
      closePersistentConnection(target);
      throw error;
    }
  } else {
    // Disable network capture
    if (hasPersistentConnection(target)) {
      try {
        const cdp = await getCDPClient(target, true);
        await cdp.send("Network.disable");
      } catch (e) {
        // Ignore errors during disable (connection may already be closed)
      }
      closePersistentConnection(target);
    }
    
    captureState.set(target, false);
    const count = getNetworkBufferSize(target);
    return { capturing: false, requestsCount: count };
  }
}

// ============================================================================
// Headers Management
// ============================================================================

// Track headers per tab
const headerStore = new Map<string, Record<string, string>>();
const clearOnNavigateStore = new Set<string>();

export interface HeadersResult {
  activeHeaders: Record<string, string>;
}

/**
 * Set custom HTTP headers for requests via CDP
 */
export async function browser_set_headers({
  target,
  headers,
  clearOnNavigate = false
}: {
  target: string;
  headers: Record<string, string>;
  clearOnNavigate?: boolean;
}): Promise<HeadersResult> {
  const cdp = await getCDPClient(target, false);

  try {
    // Enable network domain
    await cdp.send("Network.enable");

    // Set extra headers via CDP
    await cdp.send("Network.setExtraHTTPHeaders", { headers });

    // Store for tracking (merge with existing)
    const current = headerStore.get(target) || {};
    const merged = { ...current, ...headers };
    headerStore.set(target, merged);

    // Track clearOnNavigate preference
    if (clearOnNavigate) {
      clearOnNavigateStore.add(target);
    } else {
      clearOnNavigateStore.delete(target);
    }

    return { activeHeaders: merged };
  } finally {
    cdp.close();
  }
}

/**
 * Call this from browser_navigate when clearOnNavigate is set
 */
export function clearHeadersOnNavigate(target: string): void {
  if (clearOnNavigateStore.has(target)) {
    headerStore.delete(target);
    clearOnNavigateStore.delete(target);
  }
}

/**
 * Get active headers for a target (for testing/inspection)
 */
export function getActiveHeaders(target: string): Record<string, string> {
  return headerStore.get(target) || {};
}

// ============================================================================
// CDP Passthrough Tool
// ============================================================================

/**
 * Execute arbitrary CDP methods for advanced browser control
 */
export async function browser_cdp({
  target,
  method,
  params = {},
}: {
  target: string;
  method: string;
  params?: Record<string, unknown>;
}): Promise<CDPResult> {
  // Validate method format (Domain.method)
  if (!method.includes(".") || method.split(".").length !== 2) {
    throw new Error(
      `InvalidCDPMethod: Invalid CDP method: "${method}". Must be in format "Domain.method" (e.g., "Runtime.evaluate")`
    );
  }

  const [domain] = method.split(".");

  // Validate domain exists (optional - just warn for flexibility)
  if (!VALID_CDP_DOMAINS.includes(domain as typeof VALID_CDP_DOMAINS[number])) {
    console.warn(`Warning: Unknown CDP domain "${domain}"`);
  }

  const cdp = await getCDPClient(target, false);

  try {
    const result = await cdp.send(method, params);
    return { result };
  } catch (error: any) {
    throw new Error(
      `CDPError: CDP method "${method}" failed: ${error.message}`
    );
  }
}
