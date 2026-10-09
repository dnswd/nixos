{ pkgs, ... }:
let
  custom-vscode = pkgs.vscode-with-extensions.override {
    vscodeExtensions = with pkgs.vscode-extensions; [
      ms-python.python
      jnoortheen.nix-ide
      mkhl.direnv
      eamodio.gitlens
      usernamehw.errorlens
    ];
  };
in
{

  imports = [
    ./langs.nix
    ./git.nix
    ./neovim.nix
  ];

  # Fuzzy finder
  programs.fzf = {
    enable = true;
  };

  # Regex find directory
  programs.ripgrep.enable = true;

  # Fuzzy find directory
  programs.fd = {
    enable = true;
    ignores = [
      ".git/*"
      "node_modules/*"
    ];
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
    # jetbrains.idea-oss
    custom-vscode
    devenv
    # git-crypt
    # meld
    # wiggle
    # dive # https://github.com/wagoodman/dive
    # trivy
    # kubectl
    # act
    # Locals
    # lazydocker
    lazygit
    gh
  ];
}
