# Global Guidelines

These are global guidelines that you MUST always adhere to.

- You MUST ONLY add comments if the code you are creating is complex.
- You MUST ALWAYS perform a deeper research to find existing patterns or integrations of a code against other modules.
- You MUST ALWAYS prefer a clean and simple functional coding approach.
- You MUST ALWAYS consider if there is a better approach to a solution compared to the one being asked by the user. Feel free to challenge the user and make suggestions.
- You MUST NEVER include a test plan in pull requests

## Code Style

- Use TypeScript strict mode when available
- Prefer async/await over promises
- Use meaningful variable and function names

## Skills

### browser-tab

Interact with your live Chrome browser session via Chrome DevTools Protocol. Requires:
- Chrome with remote debugging enabled: `chrome://inspect/#remote-debugging` → toggle switch
- Node.js 22+

Commands: `list`, `snap`, `shot`, `eval`, `click`, `type`, `nav`, etc.

### rlm (extension)

Recursive Language Model orchestration with depth-limited task decomposition. Registers an `rlm` tool that:
- Decides whether to `solve` directly or `decompose` into subtasks
- Supports `sdk`, `cli`, and `tmux` backends
- Has guardrails for depth, node budget, branching, and cycle detection

Usage: `rlm({ task: "...", backend: "sdk", mode: "auto" })`
