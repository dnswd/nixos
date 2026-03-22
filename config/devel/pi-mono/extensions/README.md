# Pi-mono Extensions

This directory contains pi-mono extensions. Each extension lives in its own folder with an `index.ts` and `package.json`.

Pi-mono loads TypeScript directly via [jiti](https://github.com/unjs/jiti) - **no build step needed**.

## Layout

```
extensions/
├── package.json          # Workspace root (dev deps)
├── pnpm-workspace.yaml   # Workspace definition
├── tsconfig.json         # Shared TS config
├── eslint.config.mjs     # Shared ESLint config
├── <extension>/
│   ├── index.ts          # Extension entry point
│   └── package.json      # Extension metadata
```

## Quick Start

```bash
cd extensions
pnpm install
```

## Development Workflow

1. Edit your extension's `index.ts`
2. In pi, run `/reload` to hot-reload
3. Test your changes immediately

**Type checking (optional):**
```bash
pnpm run typecheck
pnpm run lint
pnpm run check  # both
```

## Adding a New Extension

1. Create a new folder: `extensions/<name>/`
2. Add an `index.ts` with a default export function
3. Add a `package.json`:

```json
{
  "name": "pi-extension-foo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "*"
  }
}
```

## Testing Extensions

Test a single extension directly:

```bash
pi -e ./extensions/<name>/index.ts
```

## Notes

- Dependencies shared across extensions are declared at the workspace root
- Runtime dependencies specific to an extension go in that extension's `package.json`
- Peer dependencies are resolved from the workspace root's `devDependencies`
