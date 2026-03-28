# System Prompt Extension

This extension provides dynamic context information to override the built-in system prompt.

## Features

- **Current time**: ISO and local time
- **Machine information**: OS, architecture, hostname, CPU cores
- **Working directory**: Current working directory
- **Workspace root**: Auto-detected workspace root with directory structure
- **Subagent detection**: Automatically adjusts context for subagents

## Subagent Behavior

The extension automatically detects when running as a subagent (via session ID, CWD path, or model name) and generates a **minimal context**:

- **Main agent**: Full context (time, machine info, workspace structure)
- **Subagent**: Minimal context (abbreviated time, working directory only, no machine/workspace details)
- **Instructions**: Subagents receive focused instructions to avoid environment conflicts

### Subagent Detection Criteria

- Session ID contains "subagent"
- CWD path contains "subagent"
- Model ID contains "haiku" or "mini" (commonly used for subagents)

## Usage

The extension registers a prompt generator that can be invoked automatically or manually via the `/system-prompt` command.

## Configuration

The prompt generator accepts the following parameters:

- `includeTime`: Include current time information (default: true)
- `includeMachine`: Include machine information (default: true)
- `includeCwd`: Include current working directory (default: true)
- `includeWorkspace`: Include workspace root and structure (default: true)

## Example Output (Main Agent)

```
# System Context

Current time: 2026-03-25T11:10:00.000Z
Local time: 3/25/2026, 11:10:00 AM

Operating system: NixOS 26.05 (Yarara)
Architecture: x64
Hostname: halcyon
CPU cores: 16

Working directory: /home/halcyon/.config/nixos

Workspace root: /home/halcyon/.config/nixos
Top-level directories:
  📁 config
  📁 home
  📁 lib
  📁 machine
  📁 pkgs
  📁 scripts
```

## Example Output (Subagent)

```
# Subagent Context
You are a specialized subagent focused on a specific task.

Time: 11:10:00 AM

Working directory: /home/halcyon/.config/nixos/extensions/oracle

## Subagent Instructions
Focus on your assigned task. Use the main agent's context as reference.
Do not attempt to reconfigure the environment or override settings.
```