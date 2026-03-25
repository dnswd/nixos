// extensions/librarian/index.ts
import { Type } from "@sinclair/typebox";
import {
  createAgentSession,
  createReadOnlyTools,
  DefaultResourceLoader,
  SessionManager,
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";

const LIBRARIAN_SYSTEM_PROMPT = `You are the Librarian — a specialized codebase understanding agent.

You help answer questions about large, complex codebases by reading from GitHub repositories.
You can see private repositories the user has approved access to, plus all public repositories on GitHub.

Your role is to:
- Provide thorough analysis and comprehensive explanations across repositories
- Explore relationships between different repositories
- Analyze architectural patterns across large open-source projects
- Find specific implementations across multiple codebases
- Understand code evolution and commit history
- Explain how major features work end-to-end

Always be thorough in your analysis. Use available tools to explore the codebase deeply before answering.
Provide detailed, documentation-quality responses.`;

function createSystemPromptOverride(customPrompt: string) {
  return () => [customPrompt];
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "librarian",
    label: "Librarian",
    description: `The Librarian - a specialized codebase understanding agent for large, complex codebases.

WHEN TO USE THE LIBRARIAN:
- Understanding complex multi-repository codebases
- Exploring relationships between different repositories
- Analyzing architectural patterns across large open-source projects
- Finding specific implementations across multiple codebases
- Understanding code evolution and commit history
- Getting comprehensive explanations of how major features work

WHEN NOT TO USE THE LIBRARIAN:
- Simple local file reading (use Read directly)
- Local codebase searches (use finder)
- Code modifications or implementations (use other tools)`,

    parameters: Type.Object({
      query: Type.String({
        description:
          "Your question about the codebase. Be specific about what you want to understand or explore.",
      }),
      context: Type.Optional(
        Type.String({
          description:
            "Optional context about what you're trying to achieve or background information.",
        })
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx: ExtensionContext) {
      onUpdate?.({ content: [{ type: "text", text: "The Librarian is researching..." }], details: {} });

      let prompt = params.query;
      if (params.context) {
        prompt += `\n\n## Context\n${params.context}`;
      }

      const librarianModel = ctx.modelRegistry.find("ollama", "qwen3-coder:latest");
      if (!librarianModel) {
        return {
          content: [{ type: "text", text: "Librarian model not found." }],
          details: { error: "Model not found" },
        };
      }

      const tools = createReadOnlyTools(ctx.cwd);
      const resourceLoader = new DefaultResourceLoader({
        cwd: ctx.cwd,
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        appendSystemPromptOverride: createSystemPromptOverride(LIBRARIAN_SYSTEM_PROMPT),
      });
      await resourceLoader.reload();

      const { session } = await createAgentSession({
        cwd: ctx.cwd,
        model: librarianModel,
        tools,
        resourceLoader,
        sessionManager: SessionManager.inMemory(),
      });

      let output = "";
      let toolCallCount = 0;

      const unsubscribe = session.subscribe((event) => {
        if (signal?.aborted) return;

        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "text_delta"
        ) {
          output += event.assistantMessageEvent.delta;
          onUpdate?.({ content: [{ type: "text", text: `Librarian researching... (${output.length} chars)` }], details: {} });
        }

        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "toolcall_end"
        ) {
          toolCallCount++;
          onUpdate?.({ content: [{ type: "text", text: `Librarian exploring... (${toolCallCount} tool calls)` }], details: {} });
        }
      });

      const abortHandler = () => {
        void session.abort();
      };

      if (signal) {
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      try {
        await session.prompt(prompt);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (signal?.aborted) {
          return {
            content: [{ type: "text", text: "Librarian research aborted." }],
            details: { aborted: true },
          };
        }
        return {
          content: [{ type: "text", text: `Librarian failed: ${message}` }],
          details: { error: message },
        };
      } finally {
        unsubscribe();
        if (signal) {
          signal.removeEventListener("abort", abortHandler);
        }
        session.dispose();
      }

      return {
        content: [
          {
            type: "text",
            text: output || "(Librarian returned no response)",
          },
        ],
        details: { toolCallCount, model: librarianModel.id },
      };
    },
  });
}
