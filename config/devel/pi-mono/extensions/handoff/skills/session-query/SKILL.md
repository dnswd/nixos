# Session Query

Query parent or ancestor sessions for additional context when needed.

## Usage

When you need more context from a previous session mentioned in the parent reference:

```
/skill:session-query <question or query>
```

## What it does

This skill allows a new session (created via handoff) to ask questions about the parent session's conversation history. It's useful when:

- You need to understand why a decision was made
- You want to see the full output of a command that was truncated in the handoff
- You need to review earlier parts of the conversation not included in the handoff summary

## How to use

When you see a parent session reference like:

```
**Parent session:** `/path/to/session.jsonl`
```

You can use this skill to query that session:

```
/skill:session-query What was the error message when we tried to compile?
```

The skill will search the parent session's history and return relevant context.

## Auto-attachment

When a handoff creates a new session, this skill is automatically referenced at the top of the prompt so you can immediately query the parent session if needed.

## Examples

- `/skill:session-query Show me the full output of the test command`
- `/skill:session-query What files were modified before the handoff?`
- `/skill:session-query Why did we choose approach A over approach B?`
