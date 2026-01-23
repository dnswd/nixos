{ pkgs, ... }:
{
  programs.vscode = {
    enable = true;
    package = pkgs.vscode;
    mutableExtensionsDir = true;
    profiles.default = {
      enableUpdateCheck = false;
      enableExtensionUpdateCheck = false;
      extensions = with pkgs.vscode-extensions; [
        # Essentials
        vscodevim.vim
        editorconfig.editorconfig
        eamodio.gitlens

        # Languages
        ms-python.python
        golang.go
        rust-lang.rust-analyzer
        jnoortheen.nix-ide

        # AI Agent
        sourcegraph.amp

        # Containers
        # ms-azuretools.vscode-docker
        # ms-kubernetes-tools.vscode-kubernetes-tools
      ];
      userSettings = {
        "editor.fontFamily" = "'FantasqueSansMono Nerd Font', monospace";
        "editor.fontSize" = 14;
        "editor.lineNumbers" = "relative";
        "editor.minimap.enabled" = false;
        "editor.formatOnSave" = true;
        "editor.tabSize" = 2;
        "editor.workbench.startupEditor" = "none";
        "editor.window.menuBarVisibility" = "toggle";
        "editor.terminal.integrated.fontFamily" = "'FantasqueSansMono Nerd Font'";
      };
    };
  };
}
