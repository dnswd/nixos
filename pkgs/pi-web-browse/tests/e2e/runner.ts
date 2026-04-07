/**
 * E2E Test Runner for pi-browser testing infrastructure.
 * Supports mock CDP mode and real Chrome mode with parallel execution.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MockCDPServer } from '../mocks/mock-cdp.js';
import { launchChrome, ChromeInstance } from './chrome-launcher.js';
import {
  TestCase,
  TestResult,
  TestSuite,
  SuiteResult,
  RunSuiteOptions,
  runSuite,
  formatAsJson,
  formatAsJUnit,
} from '../interface.js';

export interface E2EOptions {
  /** Use mock CDP server instead of real Chrome */
  mock?: boolean;
  /** Run Chrome in headless mode */
  headless?: boolean;
  /** Capture screenshot on test failure */
  screenshotOnFail?: boolean;
  /** Capture HAR on network tests */
  captureHar?: boolean;
  /** Maximum parallel test executions (default: 5) */
  parallel?: number;
  /** Reporter type (default: console) */
  reporter?: 'console' | 'json' | 'junit';
  /** Output file for reporter (optional) */
  outputFile?: string;
  /** Artifact directory for screenshots/HARs (default: tests/artifacts) */
  artifactDir?: string;
  /** Port for mock CDP server or Chrome DevTools (default: 9222) */
  port?: number;
  /** Test phase filter (e.g., 0, 1, 2) */
  phase?: number;
  /** Test ID filter (e.g., 'P0-01') */
  testId?: string;
}

interface E2EContext {
  mockServer?: MockCDPServer;
  chromeInstance?: ChromeInstance;
  isMock: boolean;
  port: number;
  artifactDir: string;
}

interface E2ETestCase extends TestCase {
  /** Screenshot path if captured on failure */
  screenshotPath?: string;
  /** HAR path if captured on network test */
  harPath?: string;
}

/**
 * Run E2E tests with the specified options.
 * @param testPath - Path to test file or directory
 * @param options - E2E execution options
 * @returns Promise resolving to test results
 */
export async function runE2E(
  testPath: string,
  options: E2EOptions = {}
): Promise<SuiteResult[]> {
  const {
    mock = false,
    headless = true,
    screenshotOnFail = true,
    captureHar = false,
    parallel = 5,
    reporter = 'console',
    outputFile,
    artifactDir = path.join(process.cwd(), 'tests', 'artifacts'),
    port = 9222,
    phase,
    testId,
  } = options;

  // Ensure artifact directory exists
  const failuresDir = path.join(artifactDir, 'failures');
  const harDir = path.join(artifactDir, 'har');
  fs.mkdirSync(failuresDir, { recursive: true });
  fs.mkdirSync(harDir, { recursive: true });

  const context: E2EContext = {
    isMock: mock,
    port,
    artifactDir,
  };

  const results: SuiteResult[] = [];
  let exitCode = 0;

  try {
    // Setup: Start mock server or launch Chrome
    if (mock) {
      if (reporter === 'console') {
        console.log('[E2E] Starting mock CDP server...');
      }
      context.mockServer = new MockCDPServer(port);
      await context.mockServer.start();

      // Add a default tab for testing
      context.mockServer.addTab({ url: 'about:blank', title: 'New Tab' });

      if (reporter === 'console') {
        console.log(`[E2E] Mock CDP server running on port ${port}`);
      }
    } else {
      if (reporter === 'console') {
        console.log('[E2E] Launching Chrome...');
      }
      context.chromeInstance = await launchChrome({ headless, port });
      if (reporter === 'console') {
        console.log(`[E2E] Chrome launched with PID ${context.chromeInstance.pid}`);
      }
    }

    // Load and filter test suites
    const suites = await loadTestSuites(testPath, { phase, testId });

    if (suites.length === 0) {
      if (reporter === 'console') {
        console.log('[E2E] No test suites found');
      }
      return [];
    }

    if (reporter === 'console') {
      console.log(`[E2E] Running ${suites.length} suite(s) with ${mock ? 'mock' : 'real Chrome'} mode`);
      console.log(`[E2E] Parallel: ${parallel}, Screenshot on fail: ${screenshotOnFail}, HAR capture: ${captureHar}`);
    }

    // Run each suite with E2E enhancements
    for (const suite of suites) {
      const enhancedSuite = enhanceSuiteForE2E(suite, context, {
        screenshotOnFail,
        captureHar,
      });

      const result = await runSuite(enhancedSuite, {
        parallel,
        reporter,
        artifactDir,
        collectArtifacts: screenshotOnFail || captureHar,
      });

      results.push(result);

      if (result.failed > 0) {
        exitCode = 1;
      }
    }

    // Output reporter results
    await outputResults(results, { reporter, outputFile });

  } finally {
    // Teardown: Stop mock server or kill Chrome
    if (context.mockServer) {
      if (reporter === 'console') {
        console.log('[E2E] Stopping mock CDP server...');
      }
      await context.mockServer.stop();
    }

    if (context.chromeInstance) {
      if (reporter === 'console') {
        console.log('[E2E] Killing Chrome...');
      }
      await context.chromeInstance.kill();
    }
  }

  // Set exit code for CLI usage
  if (exitCode !== 0 && process.exitCode === undefined) {
    process.exitCode = exitCode;
  }

  return results;
}

/**
 * Load test suites from a file or directory.
 */
async function loadTestSuites(
  testPath: string,
  filters: { phase?: number; testId?: string }
): Promise<TestSuite[]> {
  const suites: TestSuite[] = [];
  const resolvedPath = path.resolve(testPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Test path not found: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);

  if (stat.isDirectory()) {
    // Load all .test.ts files from directory
    const files = fs.readdirSync(resolvedPath, { recursive: true })
      .filter(f => f.toString().endsWith('.test.ts'))
      .map(f => path.join(resolvedPath, f.toString()));

    for (const file of files) {
      const suite = await loadTestFile(file, filters);
      if (suite) suites.push(suite);
    }
  } else {
    // Load single test file
    const suite = await loadTestFile(resolvedPath, filters);
    if (suite) suites.push(suite);
  }

  // Apply phase filter
  if (filters.phase !== undefined) {
    return suites.filter(s => s.phase === filters.phase);
  }

  return suites;
}

/**
 * Load a single test file.
 */
async function loadTestFile(
  filePath: string,
  filters: { testId?: string }
): Promise<TestSuite | null> {
  try {
    // Dynamic import of test file
    const module = await import(filePath);

    // Support various export patterns
    let suite: TestSuite | null = null;

    if (module.default && typeof module.default === 'object') {
      suite = module.default as TestSuite;
    } else if (module.suite && typeof module.suite === 'object') {
      suite = module.suite as TestSuite;
    } else if (typeof module.getSuite === 'function') {
      suite = await module.getSuite();
    }

    // Filter by test ID if specified
    if (suite && filters.testId) {
      suite.tests = suite.tests.filter(t => t.id === filters.testId);
      if (suite.tests.length === 0) {
        return null;
      }
    }

    return suite;
  } catch (err) {
    console.error(`Failed to load test file ${filePath}:`, err);
    return null;
  }
}

/**
 * Enhance a test suite with E2E-specific functionality.
 */
function enhanceSuiteForE2E(
  suite: TestSuite,
  context: E2EContext,
  options: { screenshotOnFail: boolean; captureHar: boolean }
): TestSuite {
  return {
    ...suite,
    beforeAll: async () => {
      // Run original beforeAll if exists
      if (suite.beforeAll) {
        await suite.beforeAll();
      }

      // Setup E2E context for tests
      process.env.E2E_CDP_PORT = String(context.port);
      process.env.E2E_MOCK_MODE = String(context.isMock);
    },
    afterAll: async () => {
      // Run original afterAll if exists
      if (suite.afterAll) {
        await suite.afterAll();
      }

      // Cleanup environment
      delete process.env.E2E_CDP_PORT;
      delete process.env.E2E_MOCK_MODE;
    },
    tests: suite.tests.map(test => enhanceTestCase(test, context, options)),
  };
}

/**
 * Enhance a single test case with E2E capabilities.
 */
function enhanceTestCase(
  test: TestCase,
  context: E2EContext,
  options: { screenshotOnFail: boolean; captureHar: boolean }
): E2ETestCase {
  return {
    ...test,
    test: async (): Promise<TestResult> => {
      const startTime = Date.now();
      let result: TestResult;
      let screenshotPath: string | undefined;
      let harPath: string | undefined;

      try {
        // Run the actual test
        result = await test.test();

        // If test passed, we still need to add duration
        if (!result.duration) {
          result.duration = Date.now() - startTime;
        }
      } catch (err) {
        // Test threw exception - treat as failure
        result = {
          passed: false,
          duration: Date.now() - startTime,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      // Capture screenshot on failure
      if (!result.passed && options.screenshotOnFail) {
        screenshotPath = await captureScreenshot(test.id, context);
        if (screenshotPath) {
          result.artifacts = result.artifacts || [];
          result.artifacts.push(screenshotPath);
        }
      }

      // Capture HAR for network tests
      if (options.captureHar && test.tool?.includes('network')) {
        harPath = await captureHAR(test.id, context);
        if (harPath) {
          result.artifacts = result.artifacts || [];
          result.artifacts.push(harPath);
        }
      }

      return result;
    },
  };
}

/**
 * Capture a screenshot from the current browser context.
 */
async function captureScreenshot(
  testId: string,
  context: E2EContext
): Promise<string | undefined> {
  try {
    const timestamp = Date.now();
    const filename = `${testId}-${timestamp}.png`;
    const filepath = path.join(context.artifactDir, 'failures', filename);

    if (context.isMock && context.mockServer) {
      // In mock mode, create a mock screenshot file
      // The mock server returns a 1x1 red PNG base64
      const mockPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      fs.writeFileSync(filepath, mockPng);
      return filepath;
    } else {
      // In real Chrome mode, we'd use CDP to capture screenshot
      // For now, create a placeholder file
      const placeholder = `Screenshot would be captured here for test ${testId}`;
      fs.writeFileSync(filepath.replace('.png', '.txt'), placeholder);
      // Return the .txt path since we're creating a text placeholder
      return filepath.replace('.png', '.txt');
    }
  } catch (err) {
    console.error(`Failed to capture screenshot for ${testId}:`, err);
    return undefined;
  }
}

/**
 * Capture HAR (HTTP Archive) from the current browser context.
 */
async function captureHAR(
  testId: string,
  context: E2EContext
): Promise<string | undefined> {
  try {
    const timestamp = Date.now();
    const filename = `${testId}-${timestamp}.har`;
    const filepath = path.join(context.artifactDir, 'har', filename);

    // Create HAR content
    let harContent: Record<string, unknown>;

    if (context.isMock && context.mockServer) {
      // In mock mode, get network requests from mock server
      const tabs = context.mockServer.getAllTabs();
      const entries = tabs.flatMap(tab =>
        tab.networkRequests.map(req => ({
          startedDateTime: new Date(req.timestamp).toISOString(),
          time: 0,
          request: {
            method: req.method,
            url: req.url,
            headers: [],
            queryString: [],
          },
          response: {
            status: 200,
            statusText: 'OK',
            headers: [],
          },
        }))
      );

      harContent = {
        log: {
          version: '1.2',
          creator: { name: 'pi-browser-e2e', version: '1.0.0' },
          entries,
        },
      };
    } else {
      // In real Chrome mode, we'd extract network data from CDP
      harContent = {
        log: {
          version: '1.2',
          creator: { name: 'pi-browser-e2e', version: '1.0.0' },
          entries: [],
          comment: 'Real HAR capture not yet implemented',
        },
      };
    }

    fs.writeFileSync(filepath, JSON.stringify(harContent, null, 2));
    return filepath;
  } catch (err) {
    console.error(`Failed to capture HAR for ${testId}:`, err);
    return undefined;
  }
}

/**
 * Output results based on reporter type.
 */
async function outputResults(
  results: SuiteResult[],
  options: { reporter: 'console' | 'json' | 'junit'; outputFile?: string }
): Promise<void> {
  const { reporter, outputFile } = options;

  let output: string;

  switch (reporter) {
    case 'json':
      output = formatAsJson(results);
      break;
    case 'junit':
      output = formatAsJUnit(results);
      break;
    case 'console':
    default:
      // Console output is already done during execution
      // Just print summary
      const total = results.reduce((sum, r) => sum + r.total, 0);
      const passed = results.reduce((sum, r) => sum + r.passed, 0);
      const failed = results.reduce((sum, r) => sum + r.failed, 0);
      const duration = results.reduce((sum, r) => sum + r.duration, 0);

      console.log('\n[E2E] Summary:');
      console.log(`  Total: ${total}`);
      console.log(`  Passed: ${passed}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Duration: ${duration}ms`);

      if (failed > 0) {
        console.log('\n[E2E] Failed tests:');
        for (const suite of results) {
          for (const test of suite.results) {
            if (!test.result.passed) {
              console.log(`  ✗ ${test.id}: ${test.name}`);
              if (test.result.error) {
                console.log(`    ${test.result.error}`);
              }
              if (test.result.artifacts) {
                console.log(`    Artifacts: ${test.result.artifacts.join(', ')}`);
              }
            }
          }
        }
      }

      console.log(failed === 0 ? '\n[E2E] All tests passed!' : '\n[E2E] Some tests failed.');
      return;
  }

  // Write to file or stdout
  if (outputFile) {
    fs.writeFileSync(outputFile, output);
    console.log(`[E2E] Results written to ${outputFile}`);
  } else {
    console.log(output);
  }
}

/**
 * CLI helper function to parse command line arguments and run E2E tests.
 */
export async function runE2ECLI(args: string[] = process.argv.slice(2)): Promise<void> {
  const options: E2EOptions = {};
  let testPath = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--mock') {
      options.mock = true;
    } else if (arg === '--headless') {
      options.headless = true;
    } else if (arg === '--no-headless') {
      options.headless = false;
    } else if (arg === '--screenshot-on-fail') {
      options.screenshotOnFail = true;
    } else if (arg === '--no-screenshot-on-fail') {
      options.screenshotOnFail = false;
    } else if (arg === '--capture-har') {
      options.captureHar = true;
    } else if (arg === '--parallel' && i + 1 < args.length) {
      options.parallel = parseInt(args[++i], 10);
    } else if (arg === '--reporter' && i + 1 < args.length) {
      options.reporter = args[++i] as 'console' | 'json' | 'junit';
    } else if (arg === '--output' && i + 1 < args.length) {
      options.outputFile = args[++i];
    } else if (arg === '--artifact-dir' && i + 1 < args.length) {
      options.artifactDir = args[++i];
    } else if (arg === '--port' && i + 1 < args.length) {
      options.port = parseInt(args[++i], 10);
    } else if (arg === '--phase' && i + 1 < args.length) {
      options.phase = parseInt(args[++i], 10);
    } else if (arg === '--test-id' && i + 1 < args.length) {
      options.testId = args[++i];
    } else if (!arg.startsWith('--')) {
      testPath = arg;
    }
  }

  if (!testPath) {
    console.error('Usage: runE2E <test-path> [options]');
    console.error('Options:');
    console.error('  --mock                    Use mock CDP server');
    console.error('  --headless                Run Chrome in headless mode (default)');
    console.error('  --no-headless             Run Chrome with UI visible');
    console.error('  --screenshot-on-fail      Capture screenshot on failure (default)');
    console.error('  --no-screenshot-on-fail   Disable screenshot on failure');
    console.error('  --capture-har             Capture HAR for network tests');
    console.error('  --parallel <n>            Max parallel executions (default: 5)');
    console.error('  --reporter <type>         Reporter: console, json, junit');
    console.error('  --output <file>           Write reporter output to file');
    console.error('  --artifact-dir <dir>      Artifact directory (default: tests/artifacts)');
    console.error('  --port <n>                CDP port (default: 9222)');
    console.error('  --phase <n>               Filter by phase number');
    console.error('  --test-id <id>            Filter by test ID (e.g., P0-01)');
    process.exit(1);
  }

  await runE2E(testPath, options);
}

// Run CLI if executed directly
if (require.main === module) {
  runE2ECLI().catch(err => {
    console.error('E2E runner failed:', err);
    process.exit(1);
  });
}
