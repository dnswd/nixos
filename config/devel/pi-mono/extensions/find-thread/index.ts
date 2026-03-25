// extensions/find-thread/index.ts
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "find_thread",
    label: "Find Thread",
    description: `Find Pi threads (conversation threads with the agent) using a query DSL.

This tool searches Pi threads (conversations with the agent), NOT git commits.

## Query syntax

- **Keywords**: Bare words or quoted phrases: \`auth\` or \`"race condition"\`
- **File filter**: \`file:path\` to find threads that touched a file: \`file:src/auth/login.ts\`
- **Repo filter**: \`repo:url\` to scope to a repository: \`repo:github.com/owner/repo\`
- **Author filter**: \`author:name\` to find threads by a user: \`author:alice\` or \`author:me\`
- **Date filters**: \`after:date\` and \`before:date\`: \`after:2024-01-15\`, \`after:7d\`, \`before:2w\`
- **Task filter**: \`task:id\` to find threads that worked on a task
- **Cluster filter**: \`cluster_of:id\` to find threads in the same cluster
- **Combine filters**: Use implicit AND: \`auth file:src/foo.ts repo:amp after:7d\`

All matching is case-insensitive. File paths use partial matching.`,

    parameters: Type.Object({
      query: Type.String({
        description: "Search query using DSL syntax.",
      }),
      limit: Type.Optional(
        Type.Integer({
          description: "Maximum number of threads to return. Defaults to 20.",
          minimum: 1,
          maximum: 100,
        })
      ),
    }),

    async execute(_toolCallId, params, _signal, onUpdate, _ctx: ExtensionContext) {
      onUpdate?.({ content: [{ type: "text", text: "Searching threads..." }], details: {} });

      const { query, limit = 20 } = params;

      const parsed = parseQuery(query);

      const result = `Thread search executed with query: "${query}"

Parsed filters:
- Keywords: ${parsed.keywords.length > 0 ? parsed.keywords.join(", ") : "none"}
- File: ${parsed.file || "any"}
- Repo: ${parsed.repo || "any"}
- Author: ${parsed.author || "any"}
- After: ${parsed.after || "any"}
- Before: ${parsed.before || "any"}
- Task: ${parsed.task || "any"}
- Cluster: ${parsed.cluster || "any"}
- Limit: ${limit}

Note: This is a placeholder implementation. Thread storage integration required.`;

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
        details: {
          query,
          parsed,
          limit,
          results: [],
          status: "placeholder",
        },
      };
    },
  });
}

interface ParsedQuery {
  keywords: string[];
  file?: string;
  repo?: string;
  author?: string;
  after?: string;
  before?: string;
  task?: string;
  cluster?: string;
}

function parseQuery(query: string): ParsedQuery {
  const result: ParsedQuery = { keywords: [] };

  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  for (const token of tokens) {
    if (token.startsWith("file:")) {
      result.file = token.slice(5);
    } else if (token.startsWith("repo:")) {
      result.repo = token.slice(5);
    } else if (token.startsWith("author:")) {
      result.author = token.slice(7);
    } else if (token.startsWith("after:")) {
      result.after = token.slice(6);
    } else if (token.startsWith("before:")) {
      result.before = token.slice(7);
    } else if (token.startsWith("task:")) {
      result.task = token.slice(5);
    } else if (token.startsWith("cluster_of:")) {
      result.cluster = token.slice(11);
    } else {
      result.keywords.push(token.replace(/^"|"$/g, ""));
    }
  }

  return result;
}
