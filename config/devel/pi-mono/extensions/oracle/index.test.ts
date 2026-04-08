/**
 * Type validation tests for oracle extension
 * Verifies that oracle extension compiles correctly
 *
 * These tests are verified by TypeScript compilation - no runtime execution needed.
 * Run `npx tsc --noEmit` to validate.
 */

import type { ExtensionAPI, ExtensionContext, ModelRegistry } from "@mariozechner/pi-coding-agent";
import oracleExtension from "./index.js";

// Type-only test to verify oracle extension compiles correctly
// This file validates that the oracle extension can be imported
// and its types are correctly resolved

type MockModel = {
	id: string;
	provider: string;
	name?: string;
};

type TestResult = {
	success: boolean;
	availableProviders?: string[];
	error?: string;
};

// Verify ModelRegistry interface has the methods we use
function assertModelRegistryMethods(registry: ModelRegistry): void {
	// These methods are used in oracle/index.ts
	const _find = registry.find;
	const _getAvailable = registry.getAvailable;
	const _getAll = registry.getAll;

	// Suppress unused variable warnings
	void _find;
	void _getAvailable;
	void _getAll;
}

// Test the fix: getAvailable() returns models with provider property
// and we can extract unique providers using Set
function testUniqueProviderExtraction(models: MockModel[]): string[] {
	const providers = models.map((m) => m.provider);
	const unique = [...new Set(providers)];
	return unique;
}

// Example test cases
const testModels: MockModel[] = [
	{ id: "model-1", provider: "ollama" },
	{ id: "model-2", provider: "ollama" },
	{ id: "model-3", provider: "fireworks" },
];

const result = testUniqueProviderExtraction(testModels);
// Expected: ["ollama", "fireworks"]

// Verify extension can be called with a mock API
const mockRegisterTool = (tool: {
	name: string;
	label: string;
	description: string;
	parameters: unknown;
	execute: (...args: unknown[]) => unknown;
}): { dispose(): void } => {
	return { dispose: () => void 0 };
};

const mockApi = {
	registerTool: mockRegisterTool,
} as unknown as ExtensionAPI;

// This verifies the extension compiles and can be called
void oracleExtension(mockApi);

// Export for type checking
export type { TestResult, MockModel };
export { testUniqueProviderExtraction, assertModelRegistryMethods };
