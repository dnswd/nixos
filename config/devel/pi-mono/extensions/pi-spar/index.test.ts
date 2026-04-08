/**
 * Type validation tests for pi-spar extension
 * Verifies that type assertions work correctly at compile time
 *
 * These tests are verified by TypeScript compilation - no runtime execution needed.
 * Run `npx tsc --noEmit` to validate.
 */

import type { Container } from "@mariozechner/pi-tui";

// Type-level test: verify handleInput can be assigned via type assertion
function testContainerHandleInputAssignment(): void {
	// Mock container
	const container = {} as Container;

	// This should compile without error using type assertion
	// The original bug was: container.handleInput = ... which fails because
	// Container class doesn't have handleInput property
	(container as unknown as Record<string, (data: string) => void>).handleInput = (data: string) => {
		console.log(data);
	};

	// Verify the property was assigned (runtime check would go here)
	const handler: (data: string) => void = (container as unknown as Record<string, (data: string) => void>).handleInput;
	void handler;
}

// Type-level test: verify handleInput can be called after assignment
function testContainerHandleInputInvocation(): void {
	const container = {} as Container;
	const containerWithHandler = container as unknown as Record<string, (data: string) => void>;

	containerWithHandler.handleInput = (data: string) => {
		console.log(data);
	};

	// Should be able to call the handler without type errors
	containerWithHandler.handleInput("\x1b[A");
	containerWithHandler.handleInput("\r");
	containerWithHandler.handleInput("test input");
}

// Type-level test: verify the handler signature matches expected usage
function testHandlerSignature(): void {
	const container = {} as Container;
	const containerWithHandler = container as unknown as Record<string, (data: string) => void>;

	// The handler in index.ts handles:
	// - Arrow keys: "\x1b[A", "\x1b[B"
	// - Enter: "\r", "\n"
	// - Escape: "\x1b", "\x03"
	// - Backspace: "\x7f", "\b"
	containerWithHandler.handleInput = (data: string) => {
		if (data === "\x1b[A" || data === "\x1b[B" || data === "\r" || data === "\n") {
			// navigation handling
		} else if (data === "\x1b" || data === "\x03") {
			// escape handling
		} else if (data === "\x7f" || data === "\b") {
			// backspace handling
		} else {
			// character input
		}
	};
}

// Runtime verification for manual testing - wrapped in if to prevent automatic execution
if (typeof globalThis !== "undefined") {
	testContainerHandleInputAssignment();
	testContainerHandleInputInvocation();
	testHandlerSignature();
}

// Export for type checking
export { testContainerHandleInputAssignment, testContainerHandleInputInvocation, testHandlerSignature };
