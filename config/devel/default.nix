{ config, pkgs, ... }: {
  
  imports = [
    ./langs.nix
    ./git.nix
  ];
  
  # VSCode (standard package)
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
        
        # Containers
        ms-azuretools.vscode-docker
        ms-kubernetes-tools.vscode-kubernetes-tools
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
  
  # Fuzzy finder
  programs.fzf = {
    enable = true;
  };
  
  # Regex find directory
  programs.ripgrep.enable = true;
  
  # Fuzzy find directory
  programs.fd = {
    enable = true;
    ignores = [ ".git/*" "node_modules/*" ];
  };
  
  # Zoxide for fuzzy cd
  programs.zoxide = {
    enable = true;
    enableZshIntegration = true;
    enableBashIntegration = true;
  };
  
  # Eza for colored ls
  programs.eza = {
    enable = true;
    enableZshIntegration = true;
    enableBashIntegration = true;
  };
  
  # Direnv
  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
    enableZshIntegration = true;
  };
  
  # Manual Installations
  home.packages = with pkgs; [
    # jetbrains
    jetbrains.idea-oss
    # devenv
    # devenv.packages."${pkgs.system}".devenv
    # git-crypt
    # meld
    # wiggle
    # LLM (ChatGPT)
    # shell-gpt
    ## Testing
    # postman
    ## OCI Containers
    # dive # https://github.com/wagoodman/dive
    # trivy
    # kubectl
    # act
    # Locals
    # lazydocker
    # lazygit
    ]
    # custom standalone variant of nixvim
    ++ [ pkgs.my.neovim ];
    # home.sessionVariables.EDITOR = "nvim";
  # };
}