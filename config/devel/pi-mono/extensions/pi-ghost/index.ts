import {
	AssistantMessageComponent,
	createAgentSession,
	getMarkdownTheme,
	ToolExecutionComponent,
	UserMessageComponent,
	SessionManager,
	type AgentSession,
	type AgentSessionEvent,
	type ExtensionAPI,
	type ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { Container, Input, Key, matchesKey, Spacer, Text, type Focusable, type KeybindingsManager, type OverlayHandle, type TUI, type Component } from "@mariozechner/pi-tui";

class GhostOverlayComponent extends Container implements Focusable {
	private readonly transcriptContainer: Container;
	private readonly input: Input;
	private readonly status: Text;
	private readonly tui: TUI;
	private readonly theme: ExtensionCommandContext["ui"]["theme"];
	private readonly onSubmitMessage: (text: string) => void;
	private readonly onHideOverlay: () => void;
	private readonly onCloseOverlay: () => void;
	private streamingComponent?: AssistantMessageComponent;
	private pendingTools = new Map<string, ToolExecutionComponent>();
	private _focused = false;
	private scrollOffset = 0;
	private scrollHeight = 0;

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	constructor(
		tui: TUI,
		theme: ExtensionCommandContext["ui"]["theme"],
		keybindings: KeybindingsManager,
		onSubmitMessage: (text: string) => void,
		onHideOverlay: () => void,
		onCloseOverlay: () => void,
	) {
		super();
		this.tui = tui;
		this.theme = theme;
		this.onSubmitMessage = onSubmitMessage;
		this.onHideOverlay = onHideOverlay;
		this.onCloseOverlay = onCloseOverlay;

		this.addChild(
			new Text(
				theme.fg("accent", theme.bold(" ghost pi ")) +
					" " +
					theme.fg("dim", "ctrl+s hide • esc close • ↑↓ scroll"),
				1,
				1,
			),
		);

		this.transcriptContainer = new Container();
		this.addChild(this.transcriptContainer);
		this.addChild(new Spacer(1));

		this.status = new Text(theme.fg("dim", "Ask something quick."), 1, 0);
		this.addChild(this.status);
		this.addChild(new Spacer(1));

		this.input = new Input();
		this.input.onSubmit = (value) => {
			const text = value.trim();
			if (!text) return;
			this.input.setValue("");
			this.onSubmitMessage(text);
		};
		this.input.onEscape = () => {
			this.onCloseOverlay();
		};

		const originalHandleInput = this.input.handleInput.bind(this.input);
		this.input.handleInput = (data: string) => {
			if (matchesKey(data, Key.ctrl("s"))) {
				this.onHideOverlay();
				return;
			}
			originalHandleInput(data);
		};

		this.addChild(this.input);
	}

	setStatus(text: string): void {
		this.status.setText(this.theme.fg("dim", text));
		this.tui.requestRender();
	}

	handleInput(data: string): void {
		// Scroll keys - handle before passing to input
		if (matchesKey(data, Key.pageUp)) {
			this.scrollUp(Math.max(5, Math.floor(this.scrollHeight / 2)));
			return;
		}
		if (matchesKey(data, Key.pageDown)) {
			this.scrollDown(Math.max(5, Math.floor(this.scrollHeight / 2)));
			return;
		}
		if (matchesKey(data, Key.ctrl("home"))) {
			this.scrollToTop();
			return;
		}
		if (matchesKey(data, Key.ctrl("end"))) {
			this.scrollToBottom();
			return;
		}
		this.input.handleInput(data);
	}

	private getTranscriptLines(): number {
		let lines = 0;
		for (const child of this.transcriptContainer.getChildren()) {
			lines += child.getPreferredHeight?.() || 1;
		}
		return lines;
	}

	private scrollUp(lines: number): void {
		this.scrollOffset = Math.max(0, this.scrollOffset - lines);
		this.tui.requestRender();
	}

	private scrollDown(lines: number): void {
		const totalLines = this.getTranscriptLines();
		const maxScroll = Math.max(0, totalLines - this.scrollHeight);
		this.scrollOffset = Math.min(maxScroll, this.scrollOffset + lines);
		this.tui.requestRender();
	}

	private scrollToTop(): void {
		this.scrollOffset = 0;
		this.tui.requestRender();
	}

	private scrollToBottom(): void {
		const totalLines = this.getTranscriptLines();
		const maxScroll = Math.max(0, totalLines - this.scrollHeight);
		this.scrollOffset = maxScroll;
		this.tui.requestRender();
	}

	render(availableWidth: number): string[] {
		// Calculate scrollable content height (all children except header/status/input)
		const fixedHeight = 5; // header(1) + spacer(1) + status(1) + spacer(1) + input(1)
		this.scrollHeight = Math.max(1, this.getPreferredHeight?.(availableWidth) || 10 - fixedHeight);

		const lines: string[] = [];
		let currentY = 0;
		const children = this.getChildren();

		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			if (child === this.transcriptContainer) {
				// Render transcript container with scroll clipping
				const childLines = this.renderTranscriptWithScroll(availableWidth);
				lines.push(...childLines);
				currentY += childLines.length;
			} else {
				const childLines = child.render(availableWidth);
				lines.push(...childLines);
				currentY += childLines.length;
			}
		}
		return lines;
	}

	private renderTranscriptWithScroll(width: number): string[] {
		const children = this.transcriptContainer.getChildren();
		const lines: string[] = [];
		let currentY = 0;
		let skipY = 0;

		for (const child of children) {
			const childHeight = child.getPreferredHeight?.(width) || 1;
			const childLines = child.render(width);

			if (currentY + childHeight <= this.scrollOffset) {
				// Entirely above viewport
				currentY += childHeight;
				continue;
			}

			if (currentY >= this.scrollOffset + this.scrollHeight) {
				// Entirely below viewport, stop rendering
				break;
			}

			// Partially visible - clip and render
			const startInChild = Math.max(0, this.scrollOffset - currentY);
			const visibleLines = childHeight - startInChild;
			const endInChild = Math.min(childHeight, startInChild + Math.max(0, this.scrollHeight - skipY));

			for (let i = startInChild; i < endInChild; i++) {
				if (i < childLines.length) {
					lines.push(childLines[i]);
				}
			}

			skipY += endInChild - startInChild;
			currentY += childHeight;
		}

		// Pad to fill scroll area
		while (lines.length < this.scrollHeight) {
			lines.push("".padEnd(width, " "));
		}

		// Add scroll indicators
		const totalLines = this.getTranscriptLines();
		if (this.scrollOffset > 0 && lines.length > 0) {
			lines[0] = this.overlayScrollIndicator(lines[0], "↑");
		}
		if (this.scrollOffset + this.scrollHeight < totalLines && lines.length > 0) {
			lines[lines.length - 1] = this.overlayScrollIndicator(lines[lines.length - 1], "↓");
		}

		return lines.slice(0, this.scrollHeight);
	}

	private overlayScrollIndicator(line: string, indicator: string): string {
		if (line.length === 0) return indicator;
		const pos = Math.max(0, line.length - 1);
		return line.slice(0, pos) + indicator + line.slice(pos + 1);
	}

	handleSessionEvent(event: AgentSessionEvent): void {
		switch (event.type) {
			case "message_start": {
				if (event.message.role === "user") {
					const text = extractMessageText(event.message);
					this.transcriptContainer.addChild(new UserMessageComponent(text, getMarkdownTheme()));
					this.scrollToBottom();
					this.setStatus("Thinking...");
					break;
				}

				if (event.message.role === "assistant") {
					this.streamingComponent = new AssistantMessageComponent(undefined, false, getMarkdownTheme(), "Thinking...");
					this.transcriptContainer.addChild(this.streamingComponent);
					this.streamingComponent.updateContent(event.message);
					this.scrollToBottom();
					this.setStatus("Streaming response...");
				}
				break;
			}

			case "message_update": {
				if (this.streamingComponent && event.message.role === "assistant") {
					this.streamingComponent.updateContent(event.message);
					// Auto-scroll if at bottom
					const totalLines = this.getTranscriptLines();
					const maxScroll = Math.max(0, totalLines - this.scrollHeight);
					if (this.scrollOffset >= maxScroll - 2) {
						this.scrollToBottom();
					}
				}
				break;
			}

			case "message_end": {
				if (event.message.role !== "assistant") break;
				if (this.streamingComponent) {
					this.streamingComponent.updateContent(event.message);

					if (event.message.stopReason === "aborted" || event.message.stopReason === "error") {
						const errorMessage = event.message.errorMessage || "Error";
						for (const component of this.pendingTools.values()) {
							component.updateResult({
								content: [{ type: "text", text: errorMessage }],
								isError: true,
							});
						}
						this.pendingTools.clear();
					} else {
						for (const component of this.pendingTools.values()) {
							component.setArgsComplete();
						}
					}
					this.streamingComponent = undefined;
				}
				this.setStatus("Ask something quick.");
				break;
			}

			case "tool_execution_start": {
				let component = this.pendingTools.get(event.toolCallId);
				if (!component) {
					component = new ToolExecutionComponent(
						event.toolName,
						event.toolCallId,
						event.args,
						{ showImages: true },
						undefined,
						this.tui,
						process.cwd(),
					);
					this.transcriptContainer.addChild(component);
					this.pendingTools.set(event.toolCallId, component);
				}
				component.markExecutionStarted();
				this.scrollToBottom();
				this.setStatus(`Running ${event.toolName}...`);
				break;
			}

			case "tool_execution_update": {
				const component = this.pendingTools.get(event.toolCallId);
				if (component) {
					component.updateResult({ ...event.partialResult, isError: false }, true);
				}
				break;
			}

			case "tool_execution_end": {
				const component = this.pendingTools.get(event.toolCallId);
				if (component) {
					component.updateResult({ ...event.result, isError: event.isError });
					this.pendingTools.delete(event.toolCallId);
				}
				break;
			}

			case "agent_end": {
				this.streamingComponent = undefined;
				this.pendingTools.clear();
				this.setStatus("Ask something quick.");
				break;
			}
		}

		this.tui.requestRender();
	}
}

function extractMessageText(message: { content: Array<{ type: string; text?: string }> }): string {
	return message.content
		.filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("\n")
		.trim();
}

export default function (pi: ExtensionAPI) {
	let ghostSession: AgentSession | null = null;
	let overlayHandle: OverlayHandle | null = null;
	let overlayClosed = false;

	const cleanupGhost = (ctx?: ExtensionCommandContext) => {
		overlayClosed = true;
		if (overlayHandle) {
			try {
				overlayHandle.hide();
			} catch {
				// ignore
			}
			overlayHandle = null;
		}
		if (ghostSession) {
			ghostSession.dispose();
			ghostSession = null;
		}
		ctx?.ui.setWidget("pi-ghost", undefined);
	};

	const setHiddenState = (ctx: ExtensionCommandContext, hidden: boolean) => {
		if (!overlayHandle) return;
		overlayHandle.setHidden(hidden);
		if (hidden) {
			overlayHandle.unfocus();
			ctx.ui.setWidget(
				"pi-ghost",
				(_tui, theme) => ({
					render: () => [theme.fg("accent", "/gpi ") + theme.fg("dim", "is running • run /gpi to bring it back")],
					invalidate: () => {},
				}),
				{ placement: "aboveEditor" },
			);
		} else {
			ctx.ui.setWidget("pi-ghost", undefined);
			overlayHandle.focus();
		}
	};

	const ensureGhostSession = async (ctx: ExtensionCommandContext): Promise<AgentSession> => {
		if (ghostSession) return ghostSession;
		if (!ctx.model) throw new Error("No model selected");

		const result = await createAgentSession({
			cwd: ctx.cwd,
			model: ctx.model,
			modelRegistry: ctx.modelRegistry,
			sessionManager: SessionManager.inMemory(ctx.cwd),
		});
		ghostSession = result.session;
		return ghostSession;
	};

	const openGhostOverlay = async (ctx: ExtensionCommandContext, initialPrompt?: string) => {
		const session = await ensureGhostSession(ctx);
		overlayClosed = false;

		void ctx.ui
			.custom<void>(
				(tui, theme, keybindings, done) => {
					const overlay = new GhostOverlayComponent(
						tui,
						theme,
						keybindings,
						(text) => {
							void session.prompt(text, { images: [] });
						},
						() => {
							setHiddenState(ctx, true);
						},
						() => {
							done();
						},
					);

					const unsubscribe = session.subscribe((event) => {
						overlay.handleSessionEvent(event);
					});

					if (initialPrompt?.trim()) {
						void session.prompt(initialPrompt.trim(), { images: [] });
					}

					return {
						render: (width: number) => overlay.render(width),
						invalidate: () => overlay.invalidate(),
						handleInput: (data: string) => overlay.handleInput(data),
						get focused() {
							return overlay.focused;
						},
						set focused(value: boolean) {
							overlay.focused = value;
						},
						dispose: () => {
							unsubscribe();
						},
					};
				},
				{
					overlay: true,
					overlayOptions: {
						anchor: "bottom-center",
						width: "85%",
						maxHeight: "55%",
						margin: { bottom: 1, left: 2, right: 2 },
					},
					onHandle: (handle) => {
						overlayHandle = handle;
					},
				},
			)
			.finally(() => {
				overlayHandle = null;
				if (!overlayClosed) {
					cleanupGhost(ctx);
				}
			});
	};

	pi.registerCommand("gpi", {
		description: "Open ghost pi overlay",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/gpi requires interactive mode", "error");
				return;
			}

			const prompt = args.trim();

			if (overlayHandle) {
				if (overlayHandle.isHidden()) {
					setHiddenState(ctx, false);
				}
				if (prompt) {
					const session = await ensureGhostSession(ctx);
					void session.prompt(prompt, { images: [] });
				}
				return;
			}

			await openGhostOverlay(ctx, prompt || undefined);
		},
	});


	pi.on("session_shutdown", async (_event, ctx) => {
		cleanupGhost(ctx as ExtensionCommandContext);
	});
}
