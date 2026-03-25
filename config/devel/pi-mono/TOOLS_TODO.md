## Tools

### Bash

```json
{
  "name": "Bash",
  "description": "Executes the given shell command using bash (or sh on systems without bash).\n\n- Do NOT chain commands with `;` or `&&` or use `&` for background processes; make separate tool calls instead\n- Do NOT use interactive commands (REPLs, editors, password prompts)\n- Output is truncated to the last 50000 characters\n- Environment variables and `cd` do not persist between commands; use the `cwd` parameter instead\n- Commands run in the workspace root by default; only use `cwd` when you need a different directory (never use `cd dir && cmd`)\n- Only the last 50000 characters of the output will be returned to you along with how many lines got truncated, if any; rerun with a grep or head/tail filter if needed\n- On Windows, use PowerShell commands and `\\` path separators\n- ALWAYS quote file paths: `cat \"path with spaces/file.txt\"`\n- Use finder/Grep instead of find/grep, Read instead of cat, edit_file instead of sed\n- Only run `git commit` and `git push` if explicitly instructed by the user.",
  "parameters": {
    "type": "object",
    "properties": {
      "cmd": {
        "type": "string",
        "description": "The shell command to execute"
      },
      "cwd": {
        "type": "string",
        "description": "Absolute path to a directory where the command will be executed (must be absolute, not relative)"
      }
    },
    "required": ["cmd"]
  }
}
```

### create_file

```json
{
  "name": "create_file",
  "description": "Create or overwrite a file in the workspace.\n\nUse this tool to create a **new file** that does not yet exist.\n\nFor **existing files**, prefer `edit_file` instead—even for extensive changes. Only use `create_file` to overwrite an existing file when you are replacing nearly all of its content AND the file is small (under ~250 lines).",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The absolute path of the file to be created (must be absolute, not relative). If the file exists, it will be overwritten. ALWAYS generate this argument first."
      },
      "content": {
        "type": "string",
        "description": "The content for the file."
      }
    },
    "required": ["path", "content"]
  }
}
```

### edit_file

```json
{
  "name": "edit_file",
  "description": "Make edits to a text file.\n\nReplaces `old_str` with `new_str` in the given file.\n\nReturns a git-style diff showing the changes made as formatted markdown, along with the line range ([startLine, endLine]) of the changed content. The diff is also shown to the user.\n\nThe file specified by `path` MUST exist, and it MUST be an absolute path. If you need to create a new file, use `create_file` instead.\n\n`old_str` MUST exist in the file. Use tools like `Read` to understand the files you are editing before changing them.\n\n`old_str` and `new_str` MUST be different from each other.\n\nSet `replace_all` to true to replace all occurrences of `old_str` in the file. Else, `old_str` MUST be unique within the file or the edit will fail. Additional lines of context can be added to make the string more unique.\n\nIf you need to replace the entire contents of a file, use `create_file` instead, since it requires less tokens for the same action (since you won't have to repeat the contents before replacing)",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The absolute path to the file (MUST be absolute, not relative). File must exist. ALWAYS generate this argument first."
      },
      "old_str": {
        "type": "string",
        "description": "Text to search for. Must match exactly."
      },
      "new_str": {
        "type": "string",
        "description": "Text to replace old_str with."
      },
      "replace_all": {
        "type": "boolean",
        "default": false,
        "description": "Set to true to replace all matches of old_str. Else, old_str must be an unique match."
      }
    },
    "required": ["path", "old_str", "new_str"]
  }
}
```

### find_thread

```json
{
  "name": "find_thread",
  "description": "Find Amp threads (conversation threads with the agent) using a query DSL.\n\n## What this tool finds\n\nThis tool searches **Amp threads** (conversations with the agent), NOT git commits. Use this when the user asks about threads, conversations, or Amp history.\n\n## Query syntax\n\n- **Keywords**: Bare words or quoted phrases for text search: `auth` or `\"race condition\"`\n- **File filter**: `file:path` to find threads that touched a file: `file:src/auth/login.ts`\n- **Repo filter**: `repo:url` to scope to a repository: `repo:github.com/owner/repo` or `repo:owner/repo`\n- **Author filter**: `author:name` to find threads by a user: `author:alice` or `author:me` for your own threads\n- **Date filters**: `after:date` and `before:date` to filter by date: `after:2024-01-15`, `after:7d`, `before:2w`\n- **Task filter**: `task:id` to find threads that worked on a task: `task:142`. Use `task:142+` to include threads that worked on the task's dependencies, `task:142^` to include dependents (tasks that depend on this task), or `task:142+^` for both.\n- **Cluster filter**: `cluster_of:id` to find threads in the same cluster as a thread: `cluster_of:T-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`\n- **Combine filters**: Use implicit AND: `auth file:src/foo.ts repo:amp after:7d`\n\nAll matching is case-insensitive. File paths use partial matching. Date formats: ISO dates (`2024-01-15`), relative days (`7d`), or weeks (`2w`).",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query using DSL syntax. Supports keywords, file:path, repo:url, author:name, after:date, before:date, task:id, and cluster_of:id filters."
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of threads to return. Defaults to 20."
      }
    },
    "required": ["query"]
  }
}
```

### finder

```json
{
  "name": "finder",
  "description": "Intelligently search your codebase: Use it for complex, multi-step search tasks where you need to find code based on functionality or concepts rather than exact matches. Anytime you want to chain multiple grep calls you should use this tool.\n\nWHEN TO USE THIS TOOL:\n- You must locate code by behavior or concept\n- You need to run multiple greps in sequence\n- You must correlate or look for connection between several areas of the codebase.\n- You must filter broad terms (\"config\", \"logger\", \"cache\") by context.\n- You need answers to questions such as \"Where do we validate JWT authentication headers?\" or \"Which module handles file-watcher retry logic\"\n\nWHEN NOT TO USE THIS TOOL:\n- When you know the exact file path - use Read directly\n- When looking for specific symbols or exact strings - use glob or Grep\n- When you need to create, modify files, or run terminal commands\n\nUSAGE GUIDELINES:\n1. Always spawn multiple search agents in parallel to maximise speed.\n2. Formulate your query as a precise engineering request.\n   ✓ \"Find every place we build an HTTP error response.\"\n   ✗ \"error handling search\"\n3. Name concrete artifacts, patterns, or APIs to narrow scope (e.g., \"Express middleware\", \"fs.watch debounce\").\n4. State explicit success criteria so the agent knows when to stop (e.g., \"Return file paths and line numbers for all JWT verification calls\").\n5. Never issue vague or exploratory commands - be definitive and goal-oriented.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query describing to the agent what it should. Be specific and include technical terms, file types, or expected code patterns to help the agent find relevant code. Formulate the query in a way that makes it clear to the agent when it has found the right thing."
      }
    },
    "required": ["query"]
  }
}
```

### format_file

```json
{
  "name": "format_file",
  "description": "Format a file using VS Code's formatter.\n\nThis tool is only available when running in VS Code.\n\nIt returns a git-style diff showing the changes made as formatted markdown.\n\nIMPORTANT: Use this after making large edits to files.\nIMPORTANT: Consider the return value when making further changes to the same file. Formatting might have changed the code structure.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The absolute path to the file to format (must be absolute, not relative)"
      }
    },
    "required": ["path"]
  }
}
```

### get_diagnostics

```json
{
  "name": "get_diagnostics",
  "description": "Get the diagnostics (errors, warnings, etc.) for a file or directory (prefer running for directories rather than files one by one!) Output is shown in the UI so do not repeat/summarize the diagnostics.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The absolute path to the file or directory to get the diagnostics for (must be absolute, not relative)"
      }
    },
    "required": ["path"]
  }
}
```

### glob

```json
{
  "name": "glob",
  "description": "Fast file pattern matching tool that works with any codebase size\n\nUse this tool to find files by name patterns across your codebase. It returns matching file paths sorted by most recent modification time first.\n\n## File pattern syntax\n\n- `**/*.js` - All JavaScript files in any directory\n- `src/**/*.ts` - All TypeScript files under the src directory (searches only in src)\n- `*.json` - All JSON files in the current directory\n- `**/*test*` - All files with \"test\" in their name\n- `web/src/**/*` - All files under the web/src directory\n- `**/*.{js,ts}` - All JavaScript and TypeScript files (alternative patterns)\n- `src/[a-z]*/*.ts` - TypeScript files in src subdirectories that start with lowercase letters",
  "parameters": {
    "type": "object",
    "properties": {
      "filePattern": {
        "type": "string",
        "description": "Glob pattern like \"**/*.js\" or \"src/**/*.ts\" to match files"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of results to return"
      },
      "offset": {
        "type": "number",
        "description": "Number of results to skip (for pagination)"
      }
    },
    "required": ["filePattern"]
  }
}
```

### Grep

```json
{
  "name": "Grep",
  "description": "Search for exact text patterns in files using ripgrep, a fast keyword search tool.\n\n# When to use this tool\n- Finding exact text matches (variable names, function calls, specific strings)\n- Use finder for semantic/conceptual searches\n\n# Strategy\n- Use 'path' or 'glob' to narrow searches; run multiple focused calls rather than one broad search\n- Uses Rust-style regex (escape `{` and `}`); use `literal: true` for literal text search\n\n# Constraints\n- Results are limited to 100 matches (up to 10 per file)\n- Lines are truncated at 200 characters",
  "parameters": {
    "type": "object",
    "properties": {
      "pattern": {
        "type": "string",
        "description": "The pattern to search for (regex)"
      },
      "path": {
        "type": "string",
        "description": "The file or directory path to search in. Cannot be used with glob."
      },
      "glob": {
        "type": "string",
        "description": "The glob pattern to search for. Cannot be used with path."
      },
      "caseSensitive": {
        "type": "boolean",
        "description": "Whether to search case-sensitively"
      },
      "literal": {
        "type": "boolean",
        "description": "Whether to treat the pattern as a literal string instead of a regex"
      }
    },
    "required": ["pattern"]
  }
}
```

### handoff

```json
{
  "name": "handoff",
  "description": "Hand off work to a new thread that runs in the background. Use this tool when you need to continue work in a fresh context because:\n- The current thread is getting too long and context is degrading\n- You want to start a new focused task while preserving context from the current thread\n- The current thread's context window is near capacity\n\nWhen you call this tool:\n1. A new thread will be created with relevant context from this thread\n2. The new thread will start running in the background\n3. The current thread continues to run - you can finish up any remaining work\n\nWhen the user message tells you to continue the work or to handoff to only one new thread, you should follow to the new thread by setting follow to true.\n\nThe goal parameter should describe what work should continue in the new thread. Keep it short—a single sentence or at most one paragraph. Focus on what needs to be done next, not what was already completed.",
  "parameters": {
    "type": "object",
    "properties": {
      "goal": {
        "type": "string",
        "description": "A short description of the next task to accomplish in the new thread. Should be a single sentence or at most one paragraph. Focus on what needs to be done next, not what was already completed."
      },
      "follow": {
        "type": "boolean",
        "default": false,
        "description": "If true, navigate to the new thread after creation. Use this when the current thread is stopping and work should continue in the new thread."
      }
    },
    "required": ["goal", "follow"]
  }
}
```

### librarian

```json
{
  "name": "librarian",
  "description": "The Librarian - a specialized codebase understanding agent that helps answer questions about large, complex codebases.\nThe Librarian works by reading from GitHub - it can see the private repositories the user approved access to in addition to all public repositories on GitHub.\n\nThe Librarian acts as your personal multi-repository codebase expert, providing thorough analysis and comprehensive explanations across repositories.\n\nIt's ideal for complex, multi-step analysis tasks where you need to understand code architecture, functionality, and patterns across multiple repositories.\n\nWHEN TO USE THE LIBRARIAN:\n- Understanding complex multi-repository codebases and how they work\n- Exploring relationships between different repositories\n- Analyzing architectural patterns across large open-source projects\n- Finding specific implementations across multiple codebases\n- Understanding code evolution and commit history\n- Getting comprehensive explanations of how major features work\n- Exploring how systems are designed end-to-end across repositories\n\nWHEN NOT TO USE THE LIBRARIAN:\n- Simple local file reading (use Read directly)\n- Local codebase searches (use finder)\n- Code modifications or implementations (use other tools)\n- Questions not related to understanding existing repositories",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Your question about the codebase. Be specific about what you want to understand or explore."
      },
      "context": {
        "type": "string",
        "description": "Optional context about what you're trying to achieve or background information."
      }
    },
    "required": ["query"]
  }
}
```

### look_at

```json
{
  "name": "look_at",
  "description": "Extract specific information from a local file (including PDFs, images, and other media).\n\nUse this tool when you need to extract or summarize information from a file without getting the literal contents. Always provide a clear objective describing what you want to learn or extract.\n\nPass reference files when you need to compare two or more things.\n\n## When to use this tool\n\n- Analyzing PDFs, images, or media files that the Read tool cannot interpret\n- Extracting specific information or summaries from documents\n- Describing visual content in images or diagrams\n- When you only need analyzed/extracted data, not raw file contents\n\n## When NOT to use this tool\n\n- For source code or plain text files where you need exact contents—use Read instead\n- When you need to edit the file afterward (you need the literal content from Read)\n- For simple file reading where no interpretation is needed",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Workspace-relative or absolute path to the file to analyze."
      },
      "objective": {
        "type": "string",
        "description": "Natural-language description of the analysis goal (e.g., summarize, extract data, describe image)."
      },
      "context": {
        "type": "string",
        "description": "The broader goal and context for the analysis. Include relevant background information about what you are trying to achieve and why this analysis is needed."
      },
      "referenceFiles": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Optional list of workspace-relative or absolute paths to reference files for comparison (e.g., to compare two screenshots or documents)."
      }
    },
    "required": ["path", "objective", "context"]
  }
}
```

### mermaid

```json
{
  "name": "mermaid",
  "description": "Renders a Mermaid diagram from the provided code.\n\nPROACTIVELY USE DIAGRAMS when they would better convey information than prose alone. The diagrams produced by this tool are shown to the user.\n\nYou should create diagrams WITHOUT being explicitly asked in these scenarios:\n- When explaining system architecture or component relationships\n- When describing workflows, data flows, or user journeys\n- When explaining algorithms or complex processes\n- When illustrating class hierarchies or entity relationships\n- When showing state transitions or event sequences\n\n# Citations\n- **Always include `citations` to as many nodes and edges as possible to make diagram elements clickable, linking to code locations.**\n- Keys: node IDs (e.g., `\"api\"`) or edge labels (e.g., `\"authenticate(token)\"`)\n- Values: file:// URIs with optional line range (e.g., `file:///src/api.ts#L10-L50`)",
  "parameters": {
    "type": "object",
    "properties": {
      "code": {
        "type": "string",
        "description": "The Mermaid diagram code to render (DO NOT override with custom colors or other styles, DO NOT use HTML tags in node labels)"
      },
      "citations": {
        "type": "object",
        "additionalProperties": { "type": "string" },
        "description": "REQUIRED: Map of citation keys to file:// URIs for clickable code navigation. Keys can be node IDs (e.g., \"api\") or edge labels (e.g., \"run_rollout(request)\"). Use {} if no code references apply."
      }
    },
    "required": ["code", "citations"]
  }
}
```

### oracle

```json
{
  "name": "oracle",
  "description": "Consult the Oracle - an AI advisor powered by OpenAI's GPT-5.2 reasoning model that can plan, review, and provide expert guidance.\n\nThe Oracle has access to the following tools: Read, Grep, glob, web_search, read_web_page, read_thread, find_thread.\n\nThe Oracle acts as your senior engineering advisor and can help with:\n\nWHEN TO USE THE ORACLE:\n- Code reviews and architecture feedback\n- Finding a bug in multiple files\n- Planning complex implementations or refactoring\n- Analyzing code quality and suggesting improvements\n- Answering complex technical questions that require deep reasoning\n\nWHEN NOT TO USE THE ORACLE:\n- Simple file reading or searching tasks (use Read or Grep directly)\n- Codebase searches (use finder)\n- Web browsing and searching (use read_web_page or web_search)\n- Basic code modifications and when you need to execute code changes (do it yourself or use Task)",
  "parameters": {
    "type": "object",
    "properties": {
      "task": {
        "type": "string",
        "description": "The task or question you want the Oracle to help with. Be specific about what kind of guidance, review, or planning you need."
      },
      "context": {
        "type": "string",
        "description": "Optional context about the current situation, what you've tried, or background information that would help the Oracle provide better guidance."
      },
      "files": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Optional list of specific file paths (text files, images) that the Oracle should examine as part of its analysis. These files will be attached to the Oracle input."
      }
    },
    "required": ["task"]
  }
}
```

### painter

```json
{
  "name": "painter",
  "description": "Generate an image using an AI model.\n\nIMPORTANT: Only invoke this tool when the user explicitly asks to use the \"painter\" tool. Do not use this tool automatically or proactively.\n\n- When using this tool, request a single image at a time. Multiple input reference images are OK.\n- Use savePath to specify the output file path only if the user explicitly asks for it.\n\n## When to use this tool\n\n- When the user explicitly asks to use the \"painter\" tool\n- When the user explicitly requests image generation using this tool\n\n## When NOT to use this tool\n\n- Do NOT use automatically for UI mockups, diagrams, or icons—only unless explicitly requested by user\n- For code-linked diagrams—use the \"mermaid\" tool instead\n- For analyzing existing images—use the \"look_at\" tool instead",
  "parameters": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "Detailed instructions for image generation based on user requirements. Include specifics about design, layout, style, colors, composition, and any other visual details the user mentioned."
      },
      "inputImagePaths": {
        "type": "array",
        "items": { "type": "string" },
        "maxItems": 3,
        "description": "Optional image paths provided by the user for editing or style guidance. Maximum 3 images allowed."
      },
      "savePath": {
        "type": "string",
        "description": "Optional URI string to save the generated image. Must be an absolute file URI. Only valid when a single image is generated."
      }
    },
    "required": ["prompt"]
  }
}
```

### Read

```json
{
  "name": "Read",
  "description": "Read a file or list a directory from the file system. If the path is a directory, it returns a line-numbered list of entries. If the file or directory doesn't exist, an error is returned.\n\n- The path parameter MUST be an absolute path.\n- By default, this tool returns the first 500 lines. To read more, call it multiple times with different read_ranges.\n- Use the Grep tool to find specific content in large files or files with long lines.\n- If you are unsure of the correct file path, use the glob tool to look up filenames by glob pattern.\n- The contents are returned with each line prefixed by its line number. For example, if a file has contents \"abc\\n\", you will receive \"1: abc\\n\". For directories, entries are returned one per line (without line numbers) with a trailing \"/\" for subdirectories.\n- This tool can read images (such as PNG, JPEG, and GIF files) and present them to the model visually.\n- When possible, call this tool in parallel for all files you will want to read.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The absolute path to the file or directory (MUST be absolute, not relative)."
      },
      "read_range": {
        "type": "array",
        "items": { "type": "number" },
        "minItems": 2,
        "maxItems": 2,
        "description": "An array of two integers specifying the start and end line numbers to view. Line numbers are 1-indexed. If not provided, defaults to [1, 1000]. Examples: [500, 700], [700, 1400]"
      }
    },
    "required": ["path"]
  }
}
```

### read_mcp_resource

```json
{
  "name": "read_mcp_resource",
  "description": "Read a resource from an MCP (Model Context Protocol) server.\n\nUse when the user references an MCP resource, e.g. \"read @filesystem-server:file:///path/to/document.txt\"",
  "parameters": {
    "type": "object",
    "properties": {
      "server": {
        "type": "string",
        "description": "The name or identifier of the MCP server to read from"
      },
      "uri": {
        "type": "string",
        "description": "The URI of the resource to read"
      }
    },
    "required": ["server", "uri"]
  }
}
```

### read_thread

```json
{
  "name": "read_thread",
  "description": "Read and extract relevant content from another Amp thread by its ID.\n\nThis tool fetches a thread (locally or from the server if synced), renders it as markdown, and uses AI to extract only the information relevant to your specific goal. This keeps context concise while preserving important details.\n\n## When to use this tool\n\n- When the user pastes or references an Amp thread URL (format: https://ampcode.com/threads/T-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) in their message\n- When the user references a thread ID (format: T-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx or @T-abc123)\n- When the user asks to \"apply the same approach from [thread URL]\"\n- When you need to extract specific information from a referenced thread\n\n## When NOT to use this tool\n\n- When no thread ID is mentioned\n- When working within the current thread (context is already available)",
  "parameters": {
    "type": "object",
    "properties": {
      "threadID": {
        "type": "string",
        "description": "The thread ID in format T-{uuid} (e.g., \"T-a38f981d-52da-47b1-818c-fbaa9ab56e0c\")"
      },
      "goal": {
        "type": "string",
        "description": "A clear description of what information you need from the thread. Be specific about what to extract."
      }
    },
    "required": ["threadID", "goal"]
  }
}
```

### read_web_page

```json
{
  "name": "read_web_page",
  "description": "Read the contents of a web page at a given URL.\n\nWhen only the url parameter is set, it returns the contents of the webpage converted to Markdown.\n\nWhen an objective is provided, it returns excerpts relevant to that objective.\n\nIf the user asks for the latest or recent contents, pass `forceRefetch: true` to ensure the latest content is fetched.\n\nDo NOT use for access to localhost or any other local or non-Internet-accessible URLs; use `curl` via the Bash instead.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The URL of the web page to read"
      },
      "objective": {
        "type": "string",
        "description": "A natural-language description of the research goal. If set, only relevant excerpts will be returned. If not set, the full content of the web page will be returned."
      },
      "forceRefetch": {
        "type": "boolean",
        "description": "Force a live fetch of the URL (default: use a cached version that may be a few days old)"
      }
    },
    "required": ["url"]
  }
}
```

### skill

```json
{
  "name": "skill",
  "description": "Load a specialized skill that provides domain-specific instructions and workflows.\n\nWhen you recognize that a task matches one of the available skills listed below, use this tool to load the full skill instructions.\n\nThe skill will inject detailed instructions, workflows, and access to bundled resources (scripts, references, templates) into the conversation context.\n\nParameters:\n- name: The name of the skill to load (must match one of the skills listed below)\n\n# Available Skills\n\n- **building-skills**: Use when creating any skill/agent skill/amp skill. Load FIRST—before researching existing skills or writing SKILL.md. Provides required structure, naming conventions, and frontmatter format.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "The name of the skill to load"
      },
      "arguments": {
        "type": "string",
        "description": "Optional arguments to pass to the skill"
      }
    },
    "required": ["name"]
  }
}
```

### Task

```json
{
  "name": "Task",
  "description": "Perform a task (a sub-task of the user's overall task) using a sub-agent that has access to the following tools: Grep, glob, Read, Bash, edit_file, create_file, format_file, read_web_page, get_diagnostics, web_search, finder, skill, task_list.\n\nWhen to use the Task tool:\n- When you need to perform complex multi-step tasks\n- When you need to run an operation that will produce a lot of output (tokens) that is not needed after the sub-agent's task completes\n- When you are making changes across many layers of an application (frontend, backend, API layer, etc.), after you have first planned and spec'd out the changes so they can be implemented independently by multiple sub-agents\n- When the user asks you to launch an \"agent\" or \"subagent\", because the user assumes that the agent will do a good job\n\nWhen NOT to use the Task tool:\n- When you are performing a single logical task, such as adding a new feature to a single part of an application.\n- When you're reading a single file (use Read), performing a text search (use Grep), editing a single file (use edit_file)\n- When you're not sure what changes you want to make. Use all tools available to you to determine the changes to make.\n\nHow to use the Task tool:\n- Run multiple sub-agents concurrently if the tasks may be performed independently (e.g., if they do not involve editing the same parts of the same file), by including multiple tool uses in a single assistant message.\n- You will not see the individual steps of the sub-agent's execution, and you can't communicate with it until it finishes, at which point you will receive a summary of its work.\n- Include all necessary context from the user's message and prior assistant steps, as well as a detailed plan for the task, in the task description. Be specific about what the sub-agent should return when finished to summarize its work.\n- Tell the sub-agent how to verify its work if possible (e.g., by mentioning the relevant test commands to run).\n- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.",
  "parameters": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "The task for the agent to perform. Be specific about what needs to be done and include any relevant context."
      },
      "description": {
        "type": "string",
        "description": "A very short description of the task that can be displayed to the user."
      }
    },
    "required": ["prompt", "description"]
  }
}
```

### undo_edit

```json
{
  "name": "undo_edit",
  "description": "Undo the last edit made to a file.\n\nThis command reverts the most recent edit made to the specified file.\nIt will restore the file to its state before the last edit was made.\n\nReturns a git-style diff showing the changes that were undone as formatted markdown.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The absolute path to the file whose last edit should be undone (must be absolute, not relative)"
      }
    },
    "required": ["path"]
  }
}
```

### web_search

```json
{
  "name": "web_search",
  "description": "Search the web for information relevant to a research objective.\n\nUse when you need up-to-date or precise documentation. Use `read_web_page` to fetch full content from a specific URL.",
  "parameters": {
    "type": "object",
    "properties": {
      "objective": {
        "type": "string",
        "description": "A natural-language description of the broader task or research goal, including any source or freshness guidance"
      },
      "search_queries": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Optional keyword queries to ensure matches for specific terms are prioritized (recommended for best results)"
      },
      "max_results": {
        "type": "number",
        "description": "The maximum number of results to return (default: 5)"
      }
    },
    "required": ["objective"]
  }
}
```