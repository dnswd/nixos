/**
 * System Prompt Extension - Dynamic system prompt builder for main agent and subagents.
 * 
 * This extension overrides the built-in system prompt to include additional, info such as
 * - Current time
 * - Machine information
 * - Working directory
 * - Workspace root folder
 * - Top-level directory listing
 * 
 * Automatically detects if running as a subagent and adjusts context accordingly.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

export default function overrideSystemPromptExtension(pi: ExtensionAPI) {

  pi.on("before_agent_start", async (event, ctx) => {
    const entries = ctx.sessionManager.getBranch();
    const isFirstTurn = entries.filter(e => e.type === "message").length === 0;

    // Skip if system-prompt already sent
    if (!isFirstTurn) return;

    const allTools = pi.getAllTools();
    const activeTools = pi.getActiveTools();

    const toolsList = allTools
      .filter(tool => activeTools.includes(tool.name))
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join("\n");

    const guidelines = [
      "Prefer specialized tools over Bash for better user experience",
      "When using file system tools, always use absolute file paths",
      "NEVER assume that a given library is available",
      "Always follow security best practices",
      "Do not suppress compiler, typechecker, or linter errors",
      "Keep your responses short",
    ].map(g => `- ${g}`).join("\n");

    // Snip the original prompt and replace the Pi docs section with custom guidelines
    const originalPrompt = event.systemPrompt || "";

    return {
      systemPrompt: originalPrompt,
    };
  })

}


// Detect if this is a subagent by checking if we're in a subagent session
// Subagents typically have different session characteristics
function isSubAgent(ctx: ExtensionContext): boolean {
  return (ctx.sessionManager.getSessionId()?.includes("subagent") ?? false) ||
    ctx.cwd.includes("subagent") ||
    (ctx.model?.id.toLowerCase().includes("haiku") ?? false) || // Subagents often use cheaper models
    (ctx.model?.id.toLowerCase().includes("mini") ?? false);
}