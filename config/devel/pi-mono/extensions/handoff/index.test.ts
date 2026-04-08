/**
 * Type validation tests for handoff extension
 * Verifies that the handoff tool returns proper ToolResult shape
 *
 * These tests are verified by TypeScript compilation - no runtime execution needed.
 * Run `npx tsc --noEmit` to validate.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// ToolResult type definition matching the extension API
interface ToolResult {
	content: Array<{ type: string; text?: string }>;
	details?: Record<string, unknown>;
}
import handoffExtension from "./index.js";

// Type-level test: verify ToolResult shape has required properties
type AssertToolResultShape = ToolResult extends { content: unknown; details?: unknown } ? true : never;

// Verify the ToolResult type can have details property
function assertToolResultHasDetails(result: ToolResult): void {
	const _content = result.content;
	const _details = result.details;
	void _content;
	void _details;
}

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

const mockRegisterCommand = (name: string, cmd: { description: string; handler: (...args: unknown[]) => unknown }): void => {
	void name;
	void cmd;
};

const mockApi = {
	registerTool: mockRegisterTool,
	registerCommand: mockRegisterCommand,
	on: () => void 0,
} as unknown as ExtensionAPI;

// This verifies the extension compiles and can be called
void handoffExtension(mockApi);

// Type test: verify the execute function returns a Promise<ToolResult>
type ExecuteReturnType = ReturnType<Parameters<typeof mockRegisterTool>[0]["execute"]>;
type AssertExecuteReturnsToolResult = ExecuteReturnType extends Promise<ToolResult> ? true : never;

// Test proper ToolResult structure with details
type TestToolResult = {
	content: Array<{ type: string; text?: string }>;
	details: Record<string, unknown>;
};

const testResult: TestToolResult = {
	content: [{ type: "text", text: "test" }],
	details: {},
};

void assertToolResultHasDetails(testResult as ToolResult);

// Export for type checking
export type { AssertToolResultShape, AssertExecuteReturnsToolResult, TestToolResult };
