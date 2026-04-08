# pi-lsp Extension

Language Server Protocol (LSP) extension for pi. This package bundles the extension files and Node.js dependencies needed for LSP support.

## Adding New Language Servers

**Do not modify this package** to add new language servers. This package only bundles the extension's JavaScript/TypeScript code and Node.js dependencies.

### Where to Add Language Servers

All LSP servers are managed via **Home Manager** in:

```
config/devel/langs.nix
```

### Steps to Add a New Language Server

1. **Find the package in nixpkgs**
   - Search: https://search.nixos.org/packages
   - Common attribute names: `yaml-language-server`, `taplo`, `clang-tools`, etc.

2. **Add to `config/devel/langs.nix`**
   - Add the package to the `home.packages` list
   - Place it in alphabetical order under the appropriate language category
   - Follow the existing format with inline comments

3. **The pi-lsp extension auto-detects LSP servers** from your `PATH`
   - No configuration changes needed in the extension
   - No rebuild of `pkgs/pi-lsp` required

### Example

To add the Lua language server:

```nix
# Lua
lua-language-server
```

Then rebuild your Home Manager configuration:

```bash
home-manager switch
```

## Current Language Servers

See `config/devel/langs.nix` for the complete list of installed LSP servers.
