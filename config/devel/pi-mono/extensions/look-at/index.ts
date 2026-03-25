// extensions/look-at/index.ts
import { Type } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import { resolve, extname } from "node:path";
import {
  createAgentSession,
  createReadOnlyTools,
  DefaultResourceLoader,
  SessionManager,
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";

const LOOK_AT_SYSTEM_PROMPT = `You are a file analysis assistant. Your task is to analyze files and extract specific information based on the user's objective.

When analyzing images:
- Describe visual content clearly and thoroughly
- Note any text, diagrams, UI elements, or important visual details
- If comparing multiple images, highlight differences and similarities

When analyzing documents:
- Extract relevant information based on the objective
- Summarize key points
- Note any important data, tables, or figures

Always be thorough and specific in your analysis.`;

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

function createSystemPromptOverride(customPrompt: string) {
  return () => [customPrompt];
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "look_at",
    label: "Look At",
    description: `Extract specific information from a local file (including PDFs, images, and other media).

WHEN TO USE:
- Analyzing PDFs, images, or media files that the Read tool cannot interpret
- Extracting specific information or summaries from documents
- Describing visual content in images or diagrams
- When you only need analyzed/extracted data, not raw file contents

WHEN NOT TO USE:
- For source code or plain text files where you need exact contents—use Read instead
- When you need to edit the file afterward (you need the literal content from Read)
- For simple file reading where no interpretation is needed`,

    parameters: Type.Object({
      path: Type.String({
        description: "Workspace-relative or absolute path to the file to analyze.",
      }),
      objective: Type.String({
        description: "Natural-language description of the analysis goal (e.g., summarize, extract data, describe image).",
      }),
      context: Type.String({
        description: "The broader goal and context for the analysis. Include relevant background information.",
      }),
      referenceFiles: Type.Optional(
        Type.Array(Type.String(), {
          description: "Optional list of paths to reference files for comparison.",
        })
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx: ExtensionContext) {
      onUpdate?.({ content: [{ type: "text", text: "Analyzing file..." }], details: {} });

      const filePath = resolve(ctx.cwd, params.path);
      const ext = extname(filePath).toLowerCase();

      try {
        await fs.access(filePath);
      } catch {
        return {
          content: [{ type: "text", text: `File not found: ${filePath}` }],
          details: { error: "File not found" },
        };
      }

      const isImage = IMAGE_EXTENSIONS.has(ext);
      const isPdf = PDF_EXTENSIONS.has(ext);

      let prompt = `## Objective\n${params.objective}\n\n## Context\n${params.context}\n\n## File to analyze\n${filePath}`;

      if (params.referenceFiles && params.referenceFiles.length > 0) {
        const refPaths = params.referenceFiles.map((f) => resolve(ctx.cwd, f));
        prompt += `\n\n## Reference files for comparison\n${refPaths.map((f) => `- ${f}`).join("\n")}`;
      }

      if (isImage) {
        prompt += `\n\nThis is an image file. Please analyze its visual content based on the objective.`;
      } else if (isPdf) {
        prompt += `\n\nThis is a PDF file. Please extract and analyze the relevant content based on the objective.`;
      }

      const lookAtModel = ctx.modelRegistry.find("ollama", "qwen3-coder:latest");
      if (!lookAtModel) {
        return {
          content: [{ type: "text", text: "Analysis model not found." }],
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
        appendSystemPromptOverride: createSystemPromptOverride(LOOK_AT_SYSTEM_PROMPT),
      });
      await resourceLoader.reload();

      const { session } = await createAgentSession({
        cwd: ctx.cwd,
        model: lookAtModel,
        tools,
        resourceLoader,
        sessionManager: SessionManager.inMemory(),
      });

      let output = "";

      const unsubscribe = session.subscribe((event) => {
        if (signal?.aborted) return;

        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "text_delta"
        ) {
          output += event.assistantMessageEvent.delta;
          onUpdate?.({ content: [{ type: "text", text: `Analyzing... (${output.length} chars)` }], details: {} });
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
            content: [{ type: "text", text: "Analysis aborted." }],
            details: { aborted: true },
          };
        }
        return {
          content: [{ type: "text", text: `Analysis failed: ${message}` }],
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
            text: output || "(No analysis result)",
          },
        ],
        details: { file: filePath, model: lookAtModel.id },
      };
    },
  });
}
