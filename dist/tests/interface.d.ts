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
export declare function runSuite(suite: TestSuite, options?: RunSuiteOptions): Promise<SuiteResult>;
/**
 * Run multiple suites sequentially.
 */
export declare function runSuites(suites: TestSuite[], options?: RunSuiteOptions): Promise<SuiteResult[]>;
/**
 * Format suite results as JSON string.
 */
export declare function formatAsJson(results: SuiteResult | SuiteResult[]): string;
/**
 * Format suite results as JUnit XML.
 */
export declare function formatAsJUnit(results: SuiteResult[]): string;
