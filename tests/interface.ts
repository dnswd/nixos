/**
 * Standardized Test Interface for pi-browser testing infrastructure.
 * Jest/Vitest compatible with artifact collection and parallel execution.
 */

export interface TestCase {
  /** Test ID format: P0-01, P1-05, etc. */
  id: string;
  /** Human-readable test name */
  name: string;
  /** Type of test */
  type: 'unit' | 'integration' | 'e2e';
  /** Phase number (0-7) */
  phase: number;
  /** Associated tool name (e.g., browser_navigate) */
  tool?: string;
  /** Optional setup before test */
  setup?: () => Promise<void>;
  /** The actual test function - returns TestResult */
  test: () => Promise<TestResult>;
  /** Optional cleanup after test */
  teardown?: () => Promise<void>;
}

export interface TestResult {
  /** Whether the test passed */
  passed: boolean;
  /** Test duration in milliseconds */
  duration: number;
  /** Error message if test failed */
  error?: string;
  /** Paths to collected artifacts (screenshots, HAR files, etc.) */
  artifacts?: string[];
}

export interface TestSuite {
  /** Phase number (0-7) */
  phase: number;
  /** Test cases in this suite */
  tests: TestCase[];
  /** Global setup before all tests */
  beforeAll?: () => Promise<void>;
  /** Global cleanup after all tests */
  afterAll?: () => Promise<void>;
}

export interface SuiteResult {
  /** Phase number */
  phase: number;
  /** Total number of tests */
  total: number;
  /** Number of passed tests */
  passed: number;
  /** Number of failed tests */
  failed: number;
  /** Individual test results */
  results: Array<{
    id: string;
    name: string;
    result: TestResult;
  }>;
  /** Suite execution duration in milliseconds */
  duration: number;
}

export interface RunSuiteOptions {
  /** Maximum parallel executions (default: 5) */
  parallel?: number;
  /** Artifact directory path (default: 'tests/artifacts') */
  artifactDir?: string;
  /** Collect screenshots/HAR on failure */
  collectArtifacts?: boolean;
  /** Reporter type */
  reporter?: 'console' | 'json' | 'junit';
}

/**
 * Execute a test suite with parallel execution and artifact collection.
 */
export async function runSuite(
  suite: TestSuite,
  options: RunSuiteOptions = {}
): Promise<SuiteResult> {
  const {
    parallel = 5,
    reporter = 'console',
  } = options;

  const startTime = Date.now();
  const results: Array<{ id: string; name: string; result: TestResult }> = [];

  // Run global setup if provided
  if (suite.beforeAll) {
    if (reporter === 'console') {
      console.log(`[Suite P${suite.phase}] Running beforeAll...`);
    }
    await suite.beforeAll();
  }

  // Execute tests with concurrency limit
  const executing: Promise<void>[] = [];
  let index = 0;

  async function runTest(testCase: TestCase): Promise<void> {
    const testStart = Date.now();
    let testResult: TestResult;

    try {
      // Run test setup if provided
      if (testCase.setup) {
        await testCase.setup();
      }

      // Execute the test
      testResult = await testCase.test();
      testResult.duration = Date.now() - testStart;

      // Run teardown if provided
      if (testCase.teardown) {
        await testCase.teardown();
      }
    } catch (err) {
      testResult = {
        passed: false,
        duration: Date.now() - testStart,
        error: err instanceof Error ? err.message : String(err),
      };

      // Ensure teardown runs even on failure
      if (testCase.teardown) {
        try {
          await testCase.teardown();
        } catch (teardownErr) {
          testResult.error += `; Teardown error: ${teardownErr instanceof Error ? teardownErr.message : String(teardownErr)}`;
        }
      }
    }

    results.push({
      id: testCase.id,
      name: testCase.name,
      result: testResult,
    });

    if (reporter === 'console') {
      const icon = testResult.passed ? '✓' : '✗';
      const status = testResult.passed ? 'PASS' : 'FAIL';
      console.log(`  ${icon} ${testCase.id}: ${testCase.name} (${testResult.duration}ms) [${status}]`);
      if (testResult.error) {
        console.log(`    Error: ${testResult.error}`);
      }
    }
  }

  // Process tests with concurrency control
  for (const testCase of suite.tests) {
    if (executing.length >= parallel) {
      await Promise.race(executing);
    }

    const promise = runTest(testCase).then(() => {
      executing.splice(executing.indexOf(promise), 1);
    });

    executing.push(promise);
  }

  // Wait for remaining tests
  await Promise.all(executing);

  // Run global teardown if provided
  if (suite.afterAll) {
    if (reporter === 'console') {
      console.log(`[Suite P${suite.phase}] Running afterAll...`);
    }
    await suite.afterAll();
  }

  const suiteDuration = Date.now() - startTime;
  const passed = results.filter(r => r.result.passed).length;
  const failed = results.length - passed;

  // Print summary for console reporter
  if (reporter === 'console') {
    console.log(`\n[Suite P${suite.phase}] Results: ${passed} passed, ${failed} failed, ${results.length} total (${suiteDuration}ms)`);
  }

  return {
    phase: suite.phase,
    total: results.length,
    passed,
    failed,
    results,
    duration: suiteDuration,
  };
}

/**
 * Run multiple suites sequentially.
 */
export async function runSuites(
  suites: TestSuite[],
  options: RunSuiteOptions = {}
): Promise<SuiteResult[]> {
  const results: SuiteResult[] = [];
  for (const suite of suites) {
    const result = await runSuite(suite, options);
    results.push(result);
  }
  return results;
}

/**
 * Format suite results as JSON string.
 */
export function formatAsJson(results: SuiteResult | SuiteResult[]): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Format suite results as JUnit XML.
 */
export function formatAsJUnit(results: SuiteResult[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<testsuites>\n';

  for (const suite of results) {
    xml += `  <testsuite name="Phase ${suite.phase}" tests="${suite.total}" failures="${suite.failed}" time="${suite.duration / 1000}">\n`;

    for (const test of suite.results) {
      xml += `    <testcase id="${test.id}" name="${escapeXml(test.name)}" time="${test.result.duration / 1000}">\n`;
      if (!test.result.passed) {
        xml += `      <failure message="${escapeXml(test.result.error || 'Test failed')}"></failure>\n`;
      }
      xml += '    </testcase>\n';
    }

    xml += '  </testsuite>\n';
  }

  xml += '</testsuites>\n';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
