{ config, pkgs, ... }: {
  # LSP Servers - centralized location for all language servers used by pi-lsp
  # When adding a new LSP server:
  # 1. Find the package in nixpkgs: https://search.nixos.org/packages
  # 2. Add it below in alphabetical order by category
  # 3. No changes needed to pkgs/pi-lsp/ - the extension auto-detects from PATH
  home.packages =
    with pkgs; [
      # Bash / Shell
      bash-language-server

      # C / C++ (provides clangd)
      clang-tools

      # Go
      gopls

      # Java
      jdt-language-server

      # JavaScript / TypeScript
      nodePackages.typescript-language-server
      nodejs_latest

      # JSON
      vscode-json-languageserver

      # Nix
      nixd
      nixfmt
      nixpkgs-fmt
      nixpkgs-lint

      # Python
      pyright

      # Rust
      rust-analyzer

      # TOML
      taplo

      # YAML
      yaml-language-server
    ];

  # JDK Setup (https://whichjdk.com/)
  programs.java = { enable = true; package = pkgs.zulu17; };

  home.sessionPath = [ "${config.home.homeDirectory}/.jdks" ];
  # Kudos to @TLATER https://discourse.nixos.org/t/nix-language-question-linking-a-list-of-packages-to-home-files/38520
  home.file = (builtins.listToAttrs (builtins.map
    (jdk: {
      name = ".jdks/jdk-${builtins.elemAt (builtins.splitVersion jdk.version) 0}";
      value = { source = jdk; };
    })
    (with pkgs; [ zulu17 ])));
}
