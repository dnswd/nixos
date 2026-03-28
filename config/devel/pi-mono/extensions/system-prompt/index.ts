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
import persistSystemPromptExtension from "./persist.js";
import overrideSystemPromptExtension from "./override.js";

export default function systemPromptExtension(pi: ExtensionAPI) {

  // Load extensions
  persistSystemPromptExtension(pi)
  overrideSystemPromptExtension(pi)

}
