// extensions/mermaid/index.ts
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "mermaid",
    label: "Mermaid Diagram",
    description: `Renders a Mermaid diagram from the provided code.

PROACTIVELY USE DIAGRAMS when they would better convey information than prose alone.

Create diagrams WITHOUT being explicitly asked when:
- Explaining system architecture or component relationships
- Describing workflows, data flows, or user journeys
- Explaining algorithms or complex processes
- Illustrating class hierarchies or entity relationships
- Showing state transitions or event sequences

IMPORTANT: Always include citations to make diagram elements clickable, linking to code locations.`,

    parameters: Type.Object({
      code: Type.String({
        description: "The Mermaid diagram code to render (DO NOT use custom colors or HTML tags in labels)",
      }),
      citations: Type.Optional(
        Type.Record(Type.String(), Type.String(), {
          description: "Map of node IDs or edge labels to file:// URIs for clickable code navigation.",
        })
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx: ExtensionContext) {
      const { code, citations } = params;

      const diagramMarkdown = `\`\`\`mermaid\n${code}\n\`\`\``;

      let citationLinks = "";
      if (citations && Object.keys(citations).length > 0) {
        citationLinks = "\n\n**Code References:**\n";
        for (const [key, uri] of Object.entries(citations)) {
          citationLinks += `- [${key}](${uri})\n`;
        }
      }

      const output = diagramMarkdown + citationLinks;

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
        details: {
          diagramType: detectDiagramType(code),
          hasCitations: !!citations && Object.keys(citations).length > 0,
        },
      };
    },
  });
}

function detectDiagramType(code: string): string {
  const trimmed = code.trim().toLowerCase();
  if (trimmed.startsWith("graph") || trimmed.startsWith("flowchart")) return "flowchart";
  if (trimmed.startsWith("sequencediagram")) return "sequence";
  if (trimmed.startsWith("classDiagram")) return "class";
  if (trimmed.startsWith("statediagram")) return "state";
  if (trimmed.startsWith("erdiagram")) return "er";
  if (trimmed.startsWith("gantt")) return "gantt";
  if (trimmed.startsWith("pie")) return "pie";
  if (trimmed.startsWith("journey")) return "journey";
  if (trimmed.startsWith("gitgraph")) return "git";
  return "unknown";
}
