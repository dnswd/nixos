# Handoff Extension for Pi

Transfer conversation context to a new focused session. Like AmpCode's handoff feature, but integrated into Pi's extension system.

## Features

- **Auto-trigger at 90% context**: When context usage exceeds 90%, the editor is pre-filled with `/handoff `
- **User-initiated**: Run `/handoff <goal>` to handoff anytime
- **Agent-initiated**: The `handoff` tool pre-fills the editor with the command for user confirmation
- **Smart context transfer**: Generates a structured summary with file references and decision tracking
- **Collapsed file markers**: File lists appear as compact markers that expand on submit
- **Parent session tracking**: New sessions reference their parent for context queries

## Installation

This extension is part of the pi-mono extensions workspace. It will be auto-discovered when you run pi from the workspace.

## Usage

### Command

```
/handoff implement the user authentication system
```

### Tool (called by agent)

The agent can suggest a handoff by using the `handoff` tool with a goal. This pre-fills the editor with `/handoff <goal>` for user confirmation.

### Auto-trigger

When context usage exceeds 90%, you'll see:
- A notification suggesting handoff
- The editor pre-filled with `/handoff ` for you to add your goal

## How It Works

1. **Generate prompt**: The LLM creates a structured summary including:
   - Goal for the new session
   - Constraints & preferences
   - Progress (done, in-progress, blocked)
   - Key decisions
   - Next steps
   - Critical context
   - File references (read/modified)

2. **Create new session**: Uses `ctx.newSession()` with parent tracking

3. **Pre-fill editor**: The generated prompt appears in the editor for review

4. **User confirms**: Press Enter to send, or edit first

5. **File markers expand**: Collapsed file references like `[+5 read files]` expand to full XML tags on submit

## Session Ancestry

Handoff sessions track their parent. The `/skill:session-query` skill (auto-attached) lets you query parent sessions for additional context.

**Parent session:** `/path/to/parent.jsonl`

**Ancestor sessions:**
- `/path/to/grandparent.jsonl`
- `/path/to/great-grandparent.jsonl`

## Files

- `index.ts` - Extension implementation
- `package.json` - Extension manifest
- `skills/session-query/SKILL.md` - Session query skill

## Inspired By

- AmpCode's handoff workflow
- Claude Code's context compaction
- Pi's extension system
