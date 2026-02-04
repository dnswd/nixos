{ config, pkgs, ... }:
{

  imports = [
    ./langs.nix
    ./git.nix
    ./vscode.nix
    ./pi-mono
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
  home.packages =
    with pkgs;
    [
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
