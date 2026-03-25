// extensions/read-thread/index.ts
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "read_thread",
    label: "Read Thread",
    description: `Read and extract relevant content from another Pi thread by its ID.

This tool fetches a thread and uses AI to extract only the information relevant to your specific goal.

## When to use this tool

- When the user references a Pi thread URL or ID
- When the user asks to "apply the same approach from [thread URL]"
- When you need to extract specific information from a referenced thread

## When NOT to use this tool

- When no thread ID is mentioned
- When working within the current thread`,

    parameters: Type.Object({
      threadID: Type.String({
        description: 'The thread ID in format T-{uuid} (e.g., "T-a38f981d-52da-47b1-818c-fbaa9ab56e0c")',
      }),
      goal: Type.String({
        description: "A clear description of what information you need from the thread.",
      }),
    }),

    async execute(_toolCallId, params, _signal, onUpdate, _ctx: ExtensionContext) {
      onUpdate?.({ content: [{ type: "text", text: "Reading thread..." }], details: {} });

      const { threadID, goal } = params;

      if (!threadID.match(/^T-[a-f0-9-]+$/i)) {
        return {
          content: [{ type: "text", text: `Invalid thread ID format: ${threadID}` }],
          details: { error: "Invalid thread ID format" },
        };
      }

      const result = `Thread read request for: ${threadID}

Goal: ${goal}

Note: This is a placeholder implementation. Thread storage integration required to:
1. Fetch the thread content from local storage or server
2. Render it as markdown
3. Use AI to extract relevant information based on the goal

Thread ID: ${threadID}
Extraction goal: ${goal}`;

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
        details: {
          threadID,
          goal,
          status: "placeholder",
        },
      };
    },
  });
}
