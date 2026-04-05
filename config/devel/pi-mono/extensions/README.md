# Pi-mono Extensions (Nix)

This directory contains pi-mono extensions for the Nix-based dotfiles repository.

## Two Types of Extensions

### 1. Simple Extensions (This Directory)

Extensions that only need Node.js/pnpm dependencies (no external binaries or special system deps) go here.

**Structure per extension:**
- `package.json` - Extension manifest with `pi.extensions` or `pi.skills` configuration
- `index.ts` or other `.ts` files - Extension code (TypeScript, loaded via jiti)
- `node_modules/` - Dependencies (managed by pnpm)

**To install from npm:**

```bash
cd /Users/oydennisalbaihaqi/nixos/config/devel/pi-mono/extensions
npm pack @scope/package-name
tar -xzf package-name-*.tgz
mv package package-name
rm package-name-*.tgz
pnpm install
home-manager switch  # or your nix rebuild command
```

**Example: Installing @plannotator/pi-extension:**

```bash
cd /Users/oydennisalbaihaqi/nixos/config/devel/pi-mono/extensions
npm pack @plannotator/pi-extension
tar -xzf plannotator-pi-extension-*.tgz
mv package plannotator-pi-extension
rm plannotator-pi-extension-*.tgz
pnpm install
home-manager switch
```

### 2. Complex Extensions (With External Dependencies)

Extensions that need:
- External binaries (browsers, CLIs, etc.)
- Non-Node dependencies
- Special build steps
- Network fetching during build

These require a **Nix derivation** in `pkgs/<extension-name>/default.nix` instead.

**Examples in this repo:**
- `pkgs/pi-web-browse/` - Uses headless Chrome via CDP (requires browser + npm deps)
- `pkgs/pi-listen/` - Voice input extension (uses `bun` for dependency management)

**Key pattern - FOD (Fixed Output Derivation):**

For extensions that need to fetch dependencies with network access during build:

```nix
# Example from pkgs/pi-web-browse/default.nix
let
  cli = stdenv.mkDerivation rec {
    # ...
    # FOD approach: allows network access for npm install, output verified by hash
    outputHashMode = "recursive";
    outputHashAlgo = "sha256";
    outputHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";  # replace after build

    preferLocalBuild = true;
    impureEnvVars = lib.fetchers.proxyImpureEnvVars ++ [ "NIX_NPM_REGISTRY" ];

    nativeBuildInputs = [ nodejs pkgs.cacert ];
    # ...
  };
in
  # Extension wrapper that creates the pi extension entry point
  pkgs.writeTextFile { ... }
```

**To add a complex extension:**

1. Create `pkgs/<name>/default.nix` with the FOD pattern
2. Add to your system packages in your Nix config
3. Reference it in `config/devel/pi-mono/default.nix` via the `programs.pi-mono` module

## How It Works

- The `pnpm-workspace.yaml` uses pattern `./*` to include all subdirectories in this folder
- Extensions are automatically discovered by pi-mono on startup
- The Nix config symlinks this directory to `~/.pi/agent/extensions/`
- TypeScript files are loaded directly via jiti (no build step required for simple extensions)

## Do NOT Use `pi install`

The `pi install` command doesn't work in Nix environments because it tries to manage its own npm/git state. Use the methods above instead.

## See Also

- `../default.nix` - Main pi-mono configuration
- `../../pkgs/pi-web-browse/default.nix` - Example of complex extension with external deps
- `../../pkgs/pi-listen/default.nix` - Example using `bun` for dependencies
