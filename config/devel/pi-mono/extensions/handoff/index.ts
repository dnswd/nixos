/**
 * Handoff Extension - Type A
 *
 * Transfers conversation context to a new focused session when:
 * 1. Context usage exceeds 90% (auto-suggests via editor text)
 * 2. User explicitly requests it via /handoff command
 * 3. Agent requests it via handoff tool (auto-fills editor with /handoff command)
 *
 * Flow: generate handoff prompt → create new session → prompt in editor → user sends
 */

import { existsSync, readFileSync } from "node:fs";
import { complete, type Message } from "@mariozechner/pi-ai";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	SessionEntry,
	SessionHeader,
} from "@mariozechner/pi-coding-agent";
import { BorderedLoader, buildSessionContext, convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Context usage threshold to suggest handoff (90%) */
const HANDOFF_THRESHOLD_PERCENT = 90;

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a context transfer assistant. Read the conversation and produce a structured handoff summary for the stated goal. The new thread must be able to proceed without the old conversation.

Do NOT continue the conversation. Do NOT respond to any questions in the history. ONLY output the structured summary.

Use this EXACT format:

## Goal
[The user's goal for the new thread — what they want to accomplish.]

## Constraints & Preferences
- [Any requirements, constraints, or preferences the user stated]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed work relevant to the goal]

### In Progress
- [ ] [Partially completed work]

### Blocked
- [Open issues or blockers, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]
- Use code pointers (path/to/file.ts:42 or path/to/file.ts#functionName) where relevant

## Next Steps
1. [Ordered list of what should happen next, filtered by the stated goal]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Rules:
- Be concise. Every bullet earns its place.
- Preserve exact file paths, function names, and error messages.
- Only include information relevant to the stated goal — discard unrelated context.
- Output the formatted content only. No preamble, no filler.`;

const HANDOFF_SYSTEM_HINT = `
## Handoff

Use \`/handoff <goal>\` to transfer context to a new focused session.
Handoffs are especially effective after planning — clear the context and start a new session with the plan you just created.
At high context usage (>90%), pi will suggest handoff via the editor.`;

// ---------------------------------------------------------------------------
// File operation tracking
// ---------------------------------------------------------------------------

interface FileOps {
	read: Set<string>;
	written: Set<string>;
	edited: Set<string>;
}

function createFileOps(): FileOps {
	return { read: new Set(), written: new Set(), edited: new Set() };
}

function extractFileOpsFromMessage(message: any, fileOps: FileOps): void {
	if (message.role !== "assistant") return;
	if (!Array.isArray(message.content)) return;

	for (const block of message.content) {
		if (block?.type !== "toolCall" || !block.arguments || !block.name) continue;
		const path = typeof block.arguments.path === "string" ? block.arguments.path : undefined;
		if (!path) continue;

		switch (block.name) {
			case "read":
				fileOps.read.add(path);
				break;
			case "write":
				fileOps.written.add(path);
				break;
			case "edit":
				fileOps.edited.add(path);
				break;
		}
	}
}

// ---------------------------------------------------------------------------
// Collapsed file markers
// ---------------------------------------------------------------------------

type FileMarkerStore = Map<string, string>;

function createReadMarker(count: number): string {
	return `[+${count} read filename${count === 1 ? "" : "s"}]`;
}

function createModifiedMarker(count: number): string {
	return `[+${count} modified filename${count === 1 ? "" : "s"}]`;
}

function buildFileOperations(messages: any[]): { markers: string; expansions: FileMarkerStore } | null {
	const fileOps = createFileOps();
	for (const msg of messages) extractFileOpsFromMessage(msg, fileOps);

	const modified = new Set([...fileOps.edited, ...fileOps.written]);
	const readFiles = [...fileOps.read].filter((f) => !modified.has(f)).sort();
	const modifiedFiles = [...modified].sort();

	if (readFiles.length === 0 && modifiedFiles.length === 0) return null;

	const expansions: FileMarkerStore = new Map();
	const markerLines: string[] = [];

	if (readFiles.length > 0) {
		const marker = createReadMarker(readFiles.length);
		expansions.set(marker, `<read-files>\n${readFiles.join("\n")}\n</read-files>`);
		markerLines.push(marker);
	}
	if (modifiedFiles.length > 0) {
		const marker = createModifiedMarker(modifiedFiles.length);
		expansions.set(marker, `<modified-files>\n${modifiedFiles.join("\n")}\n</modified-files>`);
		markerLines.push(marker);
	}

	return { markers: markerLines.join("\n"), expansions };
}

function expandFileMarkers(text: string, store: FileMarkerStore): string {
	let result = text;
	for (const [marker, expanded] of store) {
		result = result.replaceAll(marker, expanded);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type HandoffResult = { type: "prompt"; text: string } | { type: "error"; message: string } | null;

async function generateHandoffPrompt(
	conversationText: string,
	goal: string,
	ctx: ExtensionContext,
): Promise<HandoffResult> {
	return ctx.ui.custom<HandoffResult>((tui, theme, _kb, done) => {
		const loader = new BorderedLoader(tui, theme, "Generating handoff prompt...");
		loader.onAbort = () => done(null);

		const run = async () => {
			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model!);
			if (!auth.ok) throw new Error(auth.error);
			const apiKey = auth.apiKey;

			const userMessage: Message = {
				role: "user",
				content: [
					{
						type: "text",
						text: `## Conversation History\n\n${conversationText}\n\n## User's Goal for New Thread\n\n${goal}`,
					},
				],
				timestamp: Date.now(),
			};

			const response = await complete(
				ctx.model!,
				{ systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
				{ apiKey, signal: loader.signal },
			);

			if (response.stopReason === "aborted") return null;
			if (response.stopReason === "error") {
				const msg =
					"errorMessage" in response && typeof (response as any).errorMessage === "string"
						? (response as any).errorMessage
						: "LLM request failed";
				return { type: "error" as const, message: msg };
			}

			const text = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n")
				.trim();

			return text.length > 0 ? { type: "prompt" as const, text } : { type: "error" as const, message: "LLM returned empty response" };
		};

		run()
			.then(done)
			.catch((err) => {
				const message = err instanceof Error ? err.message : String(err);
				done({ type: "error" as const, message });
			});

		return loader;
	});
}

function gatherConversation(ctx: ExtensionContext): { text: string; messages: any[] } | null {
	const branch = ctx.sessionManager.getBranch();
	const leafId = ctx.sessionManager.getLeafId();
	const { messages } = buildSessionContext(branch, leafId);

	if (messages.length === 0) return null;

	return { text: serializeConversation(convertToLlm(messages)), messages };
}

function getSessionHeader(sessionFile: string): SessionHeader | null {
	try {
		if (!existsSync(sessionFile)) return null;
		const content = readFileSync(sessionFile, "utf-8");
		const firstLine = content.slice(0, content.indexOf("\n")).trim();
		if (!firstLine) return null;
		const parsed = JSON.parse(firstLine);
		return parsed.type === "session" ? parsed : null;
	} catch {
		return null;
	}
}

function getSessionAncestry(parentSessionFile: string): string[] {
	const ancestry: string[] = [];
	const visited = new Set<string>();
	let current: string | undefined = parentSessionFile;

	while (current && !visited.has(current)) {
		visited.add(current);
		ancestry.push(current);
		const header = getSessionHeader(current);
		current = header?.parentSession;
	}

	return ancestry;
}

function wrapWithParentSession(prompt: string, parentSessionFile: string | null): string {
	if (!parentSessionFile) return prompt;

	const ancestry = getSessionAncestry(parentSessionFile);

	const lines = [`/skill:session-query`, ""];
	lines.push(`**Parent session:** \`${ancestry[0]}\``);
	if (ancestry.length > 1) {
		lines.push("");
		lines.push(`**Ancestor sessions:**`);
		for (let i = 1; i < ancestry.length; i++) {
			lines.push(`- \`${ancestry[i]}\``);
		}
	}
	lines.push("");

	return `${lines.join("\n")}${prompt}`;
}

// ---------------------------------------------------------------------------
// State for auto-suggest
// ---------------------------------------------------------------------------

let autoSuggestPending = false;
let activeFileMarkers: FileMarkerStore = new Map();

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// -- input: expand collapsed file markers before LLM sees text ----------
	pi.on("input", (event) => {
		if (activeFileMarkers.size === 0) return;

		let hasMarkers = false;
		for (const marker of activeFileMarkers.keys()) {
			if (event.text.includes(marker)) {
				hasMarkers = true;
				break;
			}
		}
		if (!hasMarkers) return;

		const expanded = expandFileMarkers(event.text, activeFileMarkers);
		activeFileMarkers = new Map();
		return { action: "transform" as const, text: expanded, images: event.images };
	});

	// -- before_agent_start: add handoff hint to system prompt --------------
	pi.on("before_agent_start", async (event, _ctx) => {
		return { systemPrompt: event.systemPrompt + HANDOFF_SYSTEM_HINT };
	});

	// -- turn_end: check context usage threshold for auto-suggest -----------
	pi.on("turn_end", (_event, ctx) => {
		if (!ctx.hasUI || autoSuggestPending) return;

		const usage = ctx.getContextUsage();
		if (!usage || usage.percent === null) return;

		if (usage.percent >= HANDOFF_THRESHOLD_PERCENT) {
			autoSuggestPending = true;
			ctx.ui.notify(
				`Context at ${Math.round(usage.percent)}%. Run "/handoff <goal>" to transfer to a new session, or continue to compact.`,
				"info",
			);
			// Pre-fill the editor with the handoff command for convenience
			const currentText = ctx.ui.getEditorText();
			if (!currentText.startsWith("/handoff")) {
				ctx.ui.setEditorText("/handoff ");
			}
		}
	});

	// -- session_before_compact: offer handoff choice ----------------------
	pi.on("session_before_compact", async (event, ctx) => {
		if (!ctx.hasUI || !ctx.model) return;

		const usage = ctx.getContextUsage();
		const pct = usage?.percent ?? 0;

		// Only offer handoff if context is high
		if (pct < HANDOFF_THRESHOLD_PERCENT && !autoSuggestPending) {
			return; // Proceed with normal compaction
		}

		autoSuggestPending = false;

		const choice = await ctx.ui.select(
			`Context is ${Math.round(pct)}% full. What would you like to do?`,
			["Handoff to new session", "Compact context", "Continue without either"],
		);

		if (choice === "Compact context" || choice === undefined) return;
		if (choice === "Continue without either") return { cancel: true };

		// User chose handoff - pre-fill editor with /handoff command
		// The user will then edit the goal and press Enter
		ctx.ui.setEditorText("/handoff ");
		ctx.ui.notify("Type your goal and press Enter to handoff to a new session", "info");

		// Cancel compaction - user will trigger handoff via command
		return { cancel: true };
	});

	// -- /handoff command (does the actual session switch) -------------------
	pi.registerCommand("handoff", {
		description: "Transfer context to a new focused session",
		handler: async (args, ctx) => {
			const goal = args.trim();
			if (!goal) {
				ctx.ui.notify("Usage: /handoff <goal for new thread>", "error");
				return;
			}

			if (!ctx.model) {
				ctx.ui.notify("No model selected.", "error");
				return;
			}

			const conv = gatherConversation(ctx);
			if (!conv) {
				ctx.ui.notify("No conversation to hand off.", "error");
				return;
			}

			const result = await generateHandoffPrompt(conv.text, goal, ctx);
			if (!result) {
				ctx.ui.notify("Handoff cancelled.", "info");
				return;
			}
			if (result.type === "error") {
				ctx.ui.notify(`Handoff failed: ${result.message}`, "error");
				return;
			}

			// Build collapsed file markers
			const fileOps = buildFileOperations(conv.messages);
			let prompt = fileOps
				? `${result.text}\n\n${fileOps.markers}`
				: result.text;

			const currentSessionFile = ctx.sessionManager.getSessionFile();
			prompt = wrapWithParentSession(prompt, currentSessionFile ?? null);

			// Store file markers for expansion when user submits
			if (fileOps) activeFileMarkers = fileOps.expansions;

			// Create new session with parent reference
			const sessionResult = await ctx.newSession({ parentSession: currentSessionFile ?? undefined });

			if (sessionResult.cancelled) {
				ctx.ui.notify("New session cancelled.", "info");
				return;
			}

			// Set the generated prompt in the editor for user to review/submit
			ctx.ui.setEditorText(prompt);
			ctx.ui.notify("Handoff ready — edit if needed, press Enter to send", "info");
		},
	});

	// -- handoff tool (agent-initiated) --------------------------------------
	pi.registerTool({
		name: "handoff",
		label: "Handoff",
		description:
			"Suggest transferring context to a new focused session. This will pre-fill the editor with '/handoff <goal>' for the user to confirm. ONLY use when the user explicitly asks for a handoff or when context is critically full.",
		parameters: Type.Object({
			goal: Type.String({ description: "The goal/task for the new session" }),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return { content: [{ type: "text" as const, text: "Handoff requires interactive mode." }] };
			}

			// Just pre-fill the editor - let user press Enter to actually run /handoff
			const goal = params.goal.trim();
			const currentText = ctx.ui.getEditorText();

			// If editor is empty or doesn't already have /handoff, set it
			if (!currentText || !currentText.startsWith("/handoff")) {
				ctx.ui.setEditorText(`/handoff ${goal}`);
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Handoff command prepared in editor: "/handoff ${goal}". Press Enter to execute, or edit the goal first.`,
					},
				],
			};
		},
	});
}
