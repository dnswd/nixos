// extensions/handoff/index.ts
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "handoff",
    label: "Handoff",
    description: `Hand off work to a new thread that runs in the background.

Use this tool when you need to continue work in a fresh context because:
- The current thread is getting too long and context is degrading
- You want to start a new focused task while preserving context
- The current thread's context window is near capacity

When you call this tool:
1. A new thread will be created with relevant context from this thread
2. The new thread will start running in the background
3. The current thread continues to run

Set follow to true to navigate to the new thread after creation.`,

    parameters: Type.Object({
      goal: Type.String({
        description: "A short description of the next task (1-2 sentences). Focus on what needs to be done, not what was completed.",
      }),
      follow: Type.Boolean({
        description: "If true, navigate to the new thread after creation.",
      }),
    }),

    async execute(_toolCallId, params, _signal, onUpdate, ctx: ExtensionContext) {
      onUpdate?.({ content: [{ type: "text", text: "Creating new thread..." }], details: {} });

      const { goal, follow } = params;

      const newThreadId = `T-${crypto.randomUUID()}`;

      const result = `Handoff initiated.

New thread: ${newThreadId}
Goal: ${goal}
Follow: ${follow}

Note: This is a placeholder implementation. Thread management integration required to:
1. Create a new thread with the specified goal
2. Transfer relevant context from the current thread
3. Start the new thread in the background
${follow ? "4. Navigate to the new thread" : "4. Continue in the current thread"}`;

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
        details: {
          newThreadId,
          goal,
          follow,
          status: "placeholder",
        },
      };
    },
  });
}
