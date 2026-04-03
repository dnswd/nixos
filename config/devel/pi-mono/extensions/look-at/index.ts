// extensions/look-at/index.ts
import { Type } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import { resolve, extname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const execFileAsync = promisify(execFile);

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

async function extractPdfText(pdfPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("pdftotext", [pdfPath, "-"]);
    return stdout;
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "look_at",
    label: "Look At",
    description: `Extract specific information from a local file (PDFs or images).

WHEN TO USE:
- Analyzing PDFs to extract text content
- Describing visual content in images or diagrams
- When you need interpreted/analyzed content rather than raw file contents

WHEN NOT TO USE:
- For source code or plain text files where you need exact contents—use Read instead
- When you need to edit the file afterward`,

    parameters: Type.Object({
      path: Type.String({
        description: "Workspace-relative or absolute path to the file to analyze.",
      }),
      objective: Type.String({
        description: "Natural-language description of the analysis goal.",
      }),
      context: Type.String({
        description: "The broader goal and context for the analysis.",
      }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx: ExtensionContext) {
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

      if (!isImage && !isPdf) {
        return {
          content: [{ type: "text", text: `Unsupported file type: ${ext}. Supported: images and PDFs.` }],
          details: { error: "Unsupported file type" },
        };
      }

      // Build content array
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];

      let headerText = `## Objective\n${params.objective}\n\n## Context\n${params.context}\n\n## File: ${filePath}`;

      if (isImage) {
        headerText += "\n\nAnalyzing attached image.";
        content.push({ type: "text", text: headerText });
        
        const imageBuffer = await fs.readFile(filePath);
        const mimeType = ext === ".png" ? "image/png" : 
                         ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
                         ext === ".gif" ? "image/gif" :
                         ext === ".webp" ? "image/webp" : "image/png";
        
        content.push({
          type: "image",
          data: imageBuffer.toString("base64"),
          mimeType
        });
      } else if (isPdf) {
        const pdfText = await extractPdfText(filePath);
        
        if (!pdfText) {
          return {
            content: [{ type: "text", text: "Failed to extract text from PDF. Ensure pdftotext is installed." }],
            details: { error: "PDF text extraction failed" },
          };
        }

        headerText += "\n\nPDF content extracted:\n\n";
        content.push({ 
          type: "text", 
          text: headerText + pdfText 
        });
      }

      return {
        content,
        details: { file: filePath, type: isPdf ? "pdf" : "image" },
      };
    },
  });
}
