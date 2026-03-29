import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

interface FailedTurn {
	entryId: string;
	prompt: string;
	error: string;
	timestamp: number;
}

export default function (pi: ExtensionAPI) {
	let lastFailedTurn: FailedTurn | null = null;
	let autoRetryEnabled = true;

	pi.on("turn_end", async (event, ctx) => {
		const msg = event.message as AssistantMessage;

		if (msg.stopReason === "error" || msg.stopReason === "aborted") {
			const promptEntry = getLastUserPrompt(ctx);
			if (promptEntry) {
				lastFailedTurn = {
					entryId: promptEntry.id,
					prompt: extractPromptText(promptEntry),
					error: msg.stopReason,
					timestamp: Date.now(),
				};

				if (autoRetryEnabled && ctx.hasUI) {
					ctx.ui.setStatus("retry-toggle", "⚠️ Failed - type /retry to retry");
				}
			}
		} else {
			lastFailedTurn = null;
			if (ctx.hasUI) {
				ctx.ui.setStatus("retry-toggle", undefined);
			}
		}
	});

	pi.on("agent_start", async (_event, ctx) => {
		if (ctx.hasUI) {
			ctx.ui.setStatus("retry-toggle", undefined);
		}
	});

	pi.registerCommand("retry", {
		description: "Retry the last failed request",
		handler: async (_args, ctx) => {
			if (!lastFailedTurn) {
				ctx.ui.notify("No failed request to retry", "info");
				return;
			}

			const prompt = lastFailedTurn.prompt;
			lastFailedTurn = null;

			if (ctx.hasUI) {
				ctx.ui.setStatus("retry-toggle", "🔄 Retrying...");
				ctx.ui.setWorkingMessage("Retrying failed request...");
				ctx.ui.notify(`Retrying: "${prompt.slice(0, 60)}${prompt.length > 60 ? "..." : ""}"`, "info");
			}

			await pi.sendUserMessage(prompt, { deliverAs: "steer" });
		},
	});

	pi.registerCommand("toggle-auto-retry", {
		description: "Toggle automatic retry on failure",
		handler: async (_args, ctx) => {
			autoRetryEnabled = !autoRetryEnabled;
			const status = autoRetryEnabled ? "enabled" : "disabled";
			ctx.ui.notify(`Auto-retry ${status}`, "info");
		},
	});
}

interface SessionMessageEntry {
	type: "message";
	id: string;
	message: {
		role: "user";
		content: string | Array<{ type: "text"; text: string }>;
	};
}

function getLastUserPrompt(ctx: ExtensionContext): PromptEntry | null {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (
			entry.type === "message" &&
			"message" in entry &&
			(entry as SessionMessageEntry).message.role === "user"
		) {
			return entry as PromptEntry;
		}
	}
	return null;
}

interface PromptEntry {
	id: string;
	message: {
		role: "user";
		content: string | Array<{ type: "text"; text: string }>;
	};
}

function extractPromptText(entry: PromptEntry): string {
	const content = entry.message.content;
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		return content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join("\n");
	}
	return "";
}
