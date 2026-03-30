// extensions/find-thread/index.ts
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { SessionManager, type SessionInfo } from "@mariozechner/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  // Keep the tool for LLM access
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

    async execute(_toolCallId, params, _signal, onUpdate, ctx: ExtensionContext) {
      onUpdate?.({ content: [{ type: "text", text: "Searching threads..." }], details: {} });

      const { query, limit = 20 } = params;

      const parsed = parseQuery(query);

      // Get all sessions for the current working directory
      const cwd = ctx.sessionManager.getCwd();
      const sessionDir = ctx.sessionManager.getSessionDir();
      const allSessions = await SessionManager.list(cwd, sessionDir);

      // Filter sessions based on query
      const filteredSessions = filterSessions(allSessions, parsed);

      // Apply limit
      const limitedResults = filteredSessions.slice(0, limit);

      // Format results
      const resultText = formatResults(limitedResults, query, parsed, filteredSessions.length);

      return {
        content: [
          {
            type: "text",
            text: resultText,
          },
        ],
        details: {
          query,
          parsed,
          limit,
          totalFound: filteredSessions.length,
          results: limitedResults.map(s => ({
            id: s.id,
            path: s.path,
            name: s.name,
            created: s.created,
            modified: s.modified,
            messageCount: s.messageCount,
            firstMessage: s.firstMessage.slice(0, 200),
          })),
        },
      };
    },
  });

  // Register a command for interactive TUI access with conversation preview
  pi.registerCommand("threads", {
    description: "Browse conversation threads with preview",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const cwd = ctx.sessionManager.getCwd();
      const sessionDir = ctx.sessionManager.getSessionDir();
      const currentSessionFile = ctx.sessionManager.getSessionFile();

      // Get all sessions for the current working directory
      const allSessions = await SessionManager.list(cwd, sessionDir);

      if (allSessions.length === 0) {
        ctx.ui.notify("No threads found for this project", "warning");
        return;
      }

      // Sort by most recent first
      const sortedSessions = allSessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      // Use custom TUI component for thread browsing with preview
      const result = await ctx.ui.custom<{ session: SessionInfo | undefined; cancelled: boolean }>(
        (tui, theme, _kb, done) => {
          let selectedIndex = 0;
          let cachedLines: string[] | undefined;
          const LIST_WIDTH = 35; // Width of the session list panel

          function refresh() {
            cachedLines = undefined;
            tui.requestRender();
          }

          function formatSessionLine(session: SessionInfo, index: number, isSelected: boolean): string {
            const isCurrent = session.path === currentSessionFile;
            const displayName = session.name || "Unnamed";
            const dateStr = session.modified.toLocaleDateString(undefined, { month: "short", day: "numeric" });
            const messageCount = session.messageCount;

            // Truncate name to fit
            const maxNameLen = 18;
            const truncatedName = displayName.length > maxNameLen ? displayName.slice(0, maxNameLen - 1) + "…" : displayName;

            const prefix = isCurrent ? "●" : "○";
            const line = `${prefix} ${truncatedName} ${dateStr} ${messageCount}M`;

            if (isSelected) {
              return theme.bg("selectedBg", theme.fg("text", truncateToWidth(line, LIST_WIDTH)));
            }
            return truncateToWidth(theme.fg("text", line), LIST_WIDTH);
          }

          function formatPreview(session: SessionInfo, width: number): string[] {
            const lines: string[] = [];
            const add = (s: string) => lines.push(s);

            // Header
            const displayName = session.name || "Unnamed session";
            const isCurrent = session.path === currentSessionFile;
            add(theme.fg("accent", theme.bold(truncateToWidth(displayName, width))));
            if (isCurrent) {
              add(theme.fg("success", "Current thread"));
            }
            add("");

            // Metadata
            const dateStr = session.modified.toLocaleString();
            add(theme.fg("muted", `Modified: ${dateStr}`));
            add(theme.fg("muted", `Messages: ${session.messageCount}`));
            add(theme.fg("muted", `ID: ${session.id.slice(0, 8)}...`));
            add("");

            // Preview from first message
            if (session.firstMessage) {
              add(theme.fg("accent", "Preview:"));
              const preview = session.firstMessage.slice(0, 200).replace(/\n/g, " ");
              const wrapped = wrapText(preview, width - 2);
              for (const line of wrapped.slice(0, 6)) {
                add(`  ${theme.fg("text", line)}`);
              }
              if (session.firstMessage.length > 200) {
                add(theme.fg("dim", "  ..."));
              }
            }

            return lines;
          }

          function wrapText(text: string, width: number): string[] {
            const words = text.split(" ");
            const lines: string[] = [];
            let currentLine = "";

            for (const word of words) {
              if ((currentLine + word).length > width) {
                lines.push(currentLine.trim());
                currentLine = word + " ";
              } else {
                currentLine += word + " ";
              }
            }
            if (currentLine.trim()) {
              lines.push(currentLine.trim());
            }
            return lines;
          }

          function handleInput(data: string) {
            if (matchesKey(data, Key.up)) {
              selectedIndex = Math.max(0, selectedIndex - 1);
              refresh();
              return;
            }
            if (matchesKey(data, Key.down)) {
              selectedIndex = Math.min(sortedSessions.length - 1, selectedIndex + 1);
              refresh();
              return;
            }
            if (matchesKey(data, Key.pageUp)) {
              selectedIndex = Math.max(0, selectedIndex - 5);
              refresh();
              return;
            }
            if (matchesKey(data, Key.pageDown)) {
              selectedIndex = Math.min(sortedSessions.length - 1, selectedIndex + 5);
              refresh();
              return;
            }
            if (matchesKey(data, Key.enter)) {
              const session = sortedSessions[selectedIndex];
              if (session.path === currentSessionFile) {
                done({ session: undefined, cancelled: true }); // Already on it
              } else {
                done({ session, cancelled: false });
              }
              return;
            }
            if (matchesKey(data, Key.escape)) {
              done({ session: undefined, cancelled: true });
              return;
            }
          }

          function render(width: number): string[] {
            if (cachedLines) return cachedLines;

            const lines: string[] = [];
            const separator = "│";
            const previewWidth = Math.max(20, width - LIST_WIDTH - 3);

            // Header
            const header = `Threads (${sortedSessions.length})` + " ".repeat(LIST_WIDTH - 15) + separator + " Preview";
            lines.push(theme.fg("accent", theme.bold(header)));
            lines.push(theme.fg("accent", "─".repeat(LIST_WIDTH) + "┼" + "─".repeat(previewWidth)));

            const selectedSession = sortedSessions[selectedIndex];
            const previewLines = selectedSession ? formatPreview(selectedSession, previewWidth) : [];

            // Calculate visible range for list
            const maxVisibleLines = Math.max(10, 20); // Minimum height
            const halfVisible = Math.floor(maxVisibleLines / 2);
            let listStart = Math.max(0, selectedIndex - halfVisible);
            let listEnd = Math.min(sortedSessions.length, listStart + maxVisibleLines);
            if (listEnd - listStart < maxVisibleLines) {
              listStart = Math.max(0, listEnd - maxVisibleLines);
            }

            // Render lines
            for (let i = 0; i < Math.max(listEnd - listStart, previewLines.length); i++) {
              const sessionIdx = listStart + i;
              let leftPart = "";

              if (sessionIdx < sortedSessions.length) {
                const session = sortedSessions[sessionIdx];
                leftPart = formatSessionLine(session, sessionIdx, sessionIdx === selectedIndex);
              } else {
                leftPart = " ".repeat(LIST_WIDTH);
              }

              const rightPart = previewLines[i] || "";
              const line = truncateToWidth(leftPart, LIST_WIDTH) + " " + separator + " " + rightPart;
              lines.push(truncateToWidth(line, width));
            }

            // Footer with help
            lines.push("");
            lines.push(theme.fg("dim", `↑↓ navigate • Enter switch • Esc cancel • ${selectedIndex + 1}/${sortedSessions.length}`));

            cachedLines = lines;
            return lines;
          }

          return {
            render,
            invalidate: () => {
              cachedLines = undefined;
            },
            handleInput,
          };
        },
        { overlay: true }
      );

      if (result.cancelled || !result.session) {
        return;
      }

      // Switch to the selected session
      const switchResult = await ctx.switchSession(result.session.path);
      if (!switchResult.cancelled) {
        ctx.ui.notify(`Switched to: ${result.session.name || "Unnamed session"}`, "info");
      }
    },
  });
}

interface ParsedQuery {
  keywords: string[];
  file?: string;
  repo?: string;
  author?: string;
  after?: Date;
  before?: Date;
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
      result.after = parseDate(token.slice(6));
    } else if (token.startsWith("before:")) {
      result.before = parseDate(token.slice(7));
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

function parseDate(dateStr: string): Date | undefined {
  // Handle relative dates like "7d", "2w", "1m"
  const relativeMatch = dateStr.match(/^(\d+)([dwmy])$/i);
  if (relativeMatch) {
    const num = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const now = new Date();
    switch (unit) {
      case "d":
        return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
      case "w":
        return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
      case "m":
        return new Date(now.getFullYear(), now.getMonth() - num, now.getDate());
      case "y":
        return new Date(now.getFullYear() - num, now.getMonth(), now.getDate());
    }
  }

  // Handle ISO date strings
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}

function filterSessions(sessions: SessionInfo[], parsed: ParsedQuery): SessionInfo[] {
  return sessions.filter(session => {
    const textToSearch = `${session.name || ""} ${session.firstMessage} ${session.allMessagesText}`.toLowerCase();

    // Keyword filter
    if (parsed.keywords.length > 0) {
      const allKeywordsMatch = parsed.keywords.every(kw =>
        textToSearch.includes(kw.toLowerCase())
      );
      if (!allKeywordsMatch) return false;
    }

    // File filter - check if any file path is mentioned
    if (parsed.file) {
      const fileLower = parsed.file.toLowerCase();
      if (!textToSearch.includes(fileLower)) return false;
    }

    // Repo filter - check session path or content
    if (parsed.repo) {
      const repoLower = parsed.repo.toLowerCase();
      const pathMatch = session.path.toLowerCase().includes(repoLower);
      const contentMatch = textToSearch.includes(repoLower);
      if (!pathMatch && !contentMatch) return false;
    }

    // Date filters
    if (parsed.after && session.modified < parsed.after) return false;
    if (parsed.before && session.modified > parsed.before) return false;

    // Author, task, and cluster filters are not directly available in SessionInfo
    // These would require additional metadata storage
    // For now, we search in the content
    if (parsed.author) {
      const authorLower = parsed.author.toLowerCase();
      if (!textToSearch.includes(authorLower)) return false;
    }

    if (parsed.task) {
      const taskLower = parsed.task.toLowerCase();
      if (!textToSearch.includes(taskLower)) return false;
    }

    if (parsed.cluster) {
      const clusterLower = parsed.cluster.toLowerCase();
      if (!textToSearch.includes(clusterLower)) return false;
    }

    return true;
  }).sort((a, b) => b.modified.getTime() - a.modified.getTime()); // Most recent first
}

function formatResults(
  sessions: SessionInfo[],
  query: string,
  parsed: ParsedQuery,
  totalFound: number
): string {
  if (sessions.length === 0) {
    return `No threads found matching query: "${query}"`;
  }

  const lines: string[] = [
    `Found ${totalFound} thread${totalFound !== 1 ? "s" : ""} matching "${query}"`,
    `Showing ${sessions.length} result${sessions.length !== 1 ? "s" : ""}:\n`,
  ];

  for (const session of sessions) {
    const dateStr = session.modified.toLocaleDateString();
    const timeStr = session.modified.toLocaleTimeString();
    const displayName = session.name || "Unnamed session";
    const preview = session.firstMessage.slice(0, 100).replace(/\n/g, " ");

    lines.push(`• ${displayName}`);
    lines.push(`  ID: ${session.id}`);
    lines.push(`  Modified: ${dateStr} ${timeStr}`);
    lines.push(`  Messages: ${session.messageCount}`);
    lines.push(`  Preview: ${preview}${session.firstMessage.length > 100 ? "..." : ""}\n`);
  }

  return lines.join("\n");
}
