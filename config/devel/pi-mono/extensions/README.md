# Pi-mono Extensions (Nix)

This directory contains pi-mono extensions for the Nix-based dotfiles repository.

## Extension Types

Extensions are categorized into two types based on their dependencies:

### Classification Criteria

| Criterion | Type A: Plain TypeScript | Type B: Nix FOD |
|-----------|--------------------------|-----------------|
| npm deps | None | Any (>=1) |
| External binaries | None | Any (browsers, sox, etc.) |
| Native modules | None | Any (requires build) |
| Network at build | No | Yes |
| Location | `extensions/<name>/` | `pkgs/<name>/` |

**Decision Flow:**
1. Does it `import` any npm package not provided by pi-mono runtime? → **Type B**
2. Does it need system binaries (chromium, curl, etc.)? → **Type B**  
3. Pure TypeScript with no external deps? → **Type A**

---

## Type A: Plain TypeScript Extensions

**Use when:** No npm dependencies, no external binaries, no native modules

**Location:** `config/devel/pi-mono/extensions/<name>/`

**Structure:**
```
extensions/
└── my-extension/
    ├── index.ts          # Entry point (exports default function)
    ├── package.json      # Optional: pi.extensions and pi.skills config
    ├── SKILL.md          # Optional: skill definition
    └── skills/
        └── my-skill/
            └── SKILL.md  # Alternative: skill subdirectory
```

**Minimal Example:**
```typescript
// extensions/hello/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });
}
```

**package.json (optional):**
```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "type": "module",
  "pi": {
    "extensions": ["./index.ts"],
    "skills": ["./SKILL.md"]
  }
}
```

No build step required - pi-mono loads TypeScript directly via jiti.

---

## Type B: Nix FOD Extensions

**Use when:** npm dependencies, external binaries, native modules, or network fetching needed

**Location:** `pkgs/<name>/default.nix`

**Pattern:** Fixed Output Derivation (FOD) for network access during build

### Git-Based Extension (e.g., pi-web-browse)

```nix
{ lib, stdenv, nodejs, fetchgit, ... }:

let
  nodeModules = stdenv.mkDerivation {
    name = "my-ext-node-modules";
    src = fetchgit { ... };
    outputHashMode = "recursive";
    outputHashAlgo = "sha256";
    outputHash = "";  # fill from first build failure
    nativeBuildInputs = [ nodejs ];
    buildPhase = ''
      npm install
      mkdir -p $out
      cp -r node_modules $out/
      cp package.json $out/
    '';
  };
in

stdenv.mkDerivation rec {
  pname = "my-ext";
  version = "1.0.0";
  src = fetchgit { ... };
  
  buildPhase = ''
    cp -r ${nodeModules}/node_modules .
  '';
  
  installPhase = ''
    mkdir -p $out/lib/my-ext
    cp -r . $out/lib/my-ext/
    rm -rf $out/lib/my-ext/node_modules/.cache
  '';
}
```

### Pure TypeScript Extension (e.g., plannotator)

No FOD needed if no npm deps to fetch:

```nix
{ lib, stdenv, fetchgit, ... }:

stdenv.mkDerivation rec {
  pname = "plannotator-pi-extension";
  version = "0.16.7";
  
  src = fetchgit {
    url = "https://github.com/backnotprop/plannotator.git";
    rev = "refs/tags/v${version}";
    hash = "sha256-...";
  };
  
  dontConfigure = true;
  dontBuild = true;  # Pure TS, pi-mono uses jiti
  
  installPhase = ''
    mkdir -p $out/lib/plannotator-pi-extension
    cp -r ${src}/apps/pi-extension/* $out/lib/plannotator-pi-extension/
  '';
}
```

### Referencing in pi-mono

Add to `pkgs/pi-mono/default.nix`:

```nix
let
  my-ext = pkgs.callPackage ../my-ext { };
in
{
  # ... in the home.file section ...
  "home.file.\".pi/agent/extensions\".source" = pkgs.runCommand "..." { }
    ''
      # ... existing extensions ...
      ln -sf ${my-ext}/lib/my-ext $out/my-ext
    '';
}
```

---

## SKILL.md Integration

Extensions can include skills that define LLM behaviors:

**Location:** `SKILL.md` in extension root or `skills/<name>/SKILL.md`

**package.json configuration:**
```json
{
  "pi": {
    "extensions": ["./index.ts"],
    "skills": ["./SKILL.md"]
  }
}
```

Skills are automatically discovered by pi-mono and can define:
- Prompt templates
- Tool usage guidelines
- Conversation behaviors

---

## Development Environment

### flake.nix Purpose

The `flake.nix` in this directory provides a **direnv-compatible development environment** for working on ad-hoc extensions.

**Use case:** Quick iteration on Type A extensions without full Nix rebuild

**Usage:**
```bash
cd config/devel/pi-mono/extensions/my-extension
# Automatic direnv activation loads dev shell
# Edit index.ts, test with `pi -e ./index.ts`
```

This is **separate** from the production Nix build (which uses `pkgs/pi-mono/default.nix`).

---

## How It Works

1. **Type A extensions** are symlinked from `~/.pi/agent/extensions/` via `home.file`
2. **Type B extensions** are built as Nix derivations and symlinked to the same location
3. **pnpm-workspace.yaml** uses `packages: ['./*']` to include all subdirectories
4. **pi-mono** discovers extensions on startup and loads TypeScript via jiti
5. **Skills** are resolved relative to the extension's `package.json`

---

## Do NOT Use `pi install`

The `pi install` command doesn't work in Nix environments because it tries to manage its own npm/git state outside the Nix store. Use the Type A or Type B patterns above instead.

---

## Reference Examples

| Extension | Type | Location | Pattern |
|-----------|------|----------|---------|
| hello-world | Type A | `extensions/hello/` | Plain TS |
| pi-web-browse | Type B | `pkgs/pi-web-browse/` | Git fetch + npm FOD |
| pi-listen | Type B | `pkgs/pi-listen/` | Git fetch + bun FOD |
| plannotator | Type B | `pkgs/plannotator-pi-extension/` | Git fetch + pure TS |
