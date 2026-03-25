// extensions/painter/index.ts
import { Type } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "painter",
    label: "Painter",
    description: `Generate an image using an AI model.

IMPORTANT: Only invoke this tool when the user explicitly asks to use the "painter" tool.
Do NOT use this tool automatically or proactively.

- Request a single image at a time (multiple input reference images are OK)
- Use savePath only if the user explicitly asks for it

WHEN TO USE:
- When user explicitly asks to use the "painter" tool
- When user explicitly requests image generation

WHEN NOT TO USE:
- Do NOT use automatically for UI mockups, diagrams, or icons
- For code-linked diagrams—use the "mermaid" tool instead
- For analyzing existing images—use the "look_at" tool instead`,

    parameters: Type.Object({
      prompt: Type.String({
        description: "Detailed instructions for image generation based on user requirements.",
      }),
      inputImagePaths: Type.Optional(
        Type.Array(Type.String(), {
          maxItems: 3,
          description: "Optional image paths for editing or style guidance (max 3).",
        })
      ),
      savePath: Type.Optional(
        Type.String({
          description: "Optional absolute file URI to save the generated image.",
        })
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx: ExtensionContext) {
      onUpdate?.({ content: [{ type: "text", text: "Generating image..." }], details: {} });

      const { prompt, inputImagePaths, savePath } = params;

      if (inputImagePaths && inputImagePaths.length > 3) {
        return {
          content: [{ type: "text", text: "Error: Maximum 3 input images allowed." }],
          details: { error: "Too many input images" },
        };
      }

      if (inputImagePaths) {
        for (const imgPath of inputImagePaths) {
          const fullPath = resolve(ctx.cwd, imgPath);
          try {
            await fs.access(fullPath);
          } catch {
            return {
              content: [{ type: "text", text: `Input image not found: ${fullPath}` }],
              details: { error: "Input image not found" },
            };
          }
        }
      }

      onUpdate?.({ content: [{ type: "text", text: "Image generation in progress..." }], details: {} });

      const result = `Image generation requested with prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}"

Note: This is a placeholder implementation. To enable actual image generation:
1. Configure an image generation API (e.g., DALL-E, Stable Diffusion)
2. Update this extension to call the configured API

Prompt details:
- Full prompt: ${prompt}
- Input images: ${inputImagePaths ? inputImagePaths.join(", ") : "none"}
- Save path: ${savePath || "not specified"}`;

      if (savePath) {
        const saveDir = dirname(savePath.replace("file://", ""));
        try {
          await fs.mkdir(saveDir, { recursive: true });
        } catch {
        }
      }

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
        details: {
          prompt,
          inputImages: inputImagePaths || [],
          savePath: savePath || null,
          status: "placeholder",
        },
      };
    },
  });
}
