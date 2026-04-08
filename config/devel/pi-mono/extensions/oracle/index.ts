import { Type } from "@sinclair/typebox";
import {
  createAgentSession,
  createReadOnlyTools,
  DefaultResourceLoader,
  SessionManager,
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "oracle",
    label: "Oracle",
    description: `Consult the Oracle — a senior AI advisor running on a separate reasoning model.

Use the Oracle for:
- Code reviews and architecture feedback
- Finding bugs spanning multiple files
- Planning complex implementations or refactoring
- Analyzing code quality and suggesting improvements
- Answering complex technical questions that require deep reasoning

Do NOT use the Oracle for:
- Simple file reading or searching (use read/grep/find directly)
- Basic code modifications (do it yourself)
- Web browsing or searching`,

    parameters: Type.Object({
      task: Type.String({
        description:
          "The task or question for the Oracle. Be specific about what kind of guidance, review, or planning you need.",
      }),
      context: Type.Optional(
        Type.String({
          description:
            "Optional background info, what you've tried, or current situation.",
        })
      ),
      files: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Optional list of file paths the Oracle should read as part of its analysis.",
        })
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx: ExtensionContext) {
      onUpdate?.({ content: [{ type: "text", text: "Consulting the Oracle..." }], details: {} });

      // Build the prompt
      let prompt = params.task;
      if (params.context) {
        prompt += `\n\n## Context\n${params.context}`;
      }
      if (params.files && params.files.length > 0) {
        prompt += `\n\n## Files to examine\n${params.files.map((f) => `- ${f}`).join("\n")}`;
      }

      // Spin up an ephemeral subagent session
      // Try to find a suitable reasoning model for the oracle
      // Priority: ollama with reasoning models, fireworks kimi-k2p5 (has reasoning), or current model
      let oracleModel = ctx.modelRegistry.find("ollama", "qwen3-coder:latest") 
        || ctx.modelRegistry.find("ollama", "qwq:latest")
        || ctx.modelRegistry.find("ollama", "deepseek-r1:latest")
        || ctx.modelRegistry.find("fireworks", "accounts/fireworks/models/kimi-k2p5");
      
      // Fallback to current session's model if no oracle-specific model found
      if (!oracleModel) {
        const currentModel = ctx.model;
        if (currentModel) {
          oracleModel = currentModel;
        } else {
          return {
            content: [{ type: "text", text: "Oracle model not found. No suitable model available in registry." }],
            details: {
              error: "Model not found",
              availableProviders: [...new Set(ctx.modelRegistry.getAvailable().map(m => m.provider))],
            },
          };
        }
      }

      const tools = createReadOnlyTools(ctx.cwd);
      const resourceLoader = new DefaultResourceLoader({
        cwd: ctx.cwd,
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
      });
      await resourceLoader.reload();

      const { session } = await createAgentSession({
        cwd: ctx.cwd,
        model: oracleModel,
        tools,
        resourceLoader,
        sessionManager: SessionManager.inMemory(),
      });

      // Collect the oracle's full response
      let output = "";
      let toolCallCount = 0;

      const unsubscribe = session.subscribe((event) => {
        if (signal?.aborted) return;

        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "text_delta"
        ) {
          output += event.assistantMessageEvent.delta;
          onUpdate?.({ content: [{ type: "text", text: `Oracle thinking... (${output.length} chars)` }], details: {} });
        }

        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "toolcall_end"
        ) {
          toolCallCount++;
          onUpdate?.({ content: [{ type: "text", text: `Oracle working... (${toolCallCount} tool calls)` }], details: {} });
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
            content: [{ type: "text", text: "Oracle consultation aborted." }],
            details: { aborted: true },
          };
        }
        return {
          content: [{ type: "text", text: `Oracle failed: ${message}` }],
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
            text: output || "(Oracle returned no response)",
          },
        ],
        details: { toolCallCount, model: oracleModel.id },
      };
    },
  });
}