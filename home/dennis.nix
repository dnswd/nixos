{
  pkgs,
  osType,
  inputs,
  ...
}:
{
  imports = [
    # ../config/devel/pi-mono
    ../config/devel/git.nix
    ../config/devel/jetbrains.nix
    ../config/devel/langs.nix
    ../config/kitty.nix
    ../config/devel/neovim.nix
    ../config/tmux.nix
    ../config/theme.nix
    ../config/starship.nix
    ../config/zsh
  ];

  programs.home-manager.enable = true;

  home.username = "oydennisalbaihaqi";
  home.homeDirectory = "/Users/oydennisalbaihaqi";
  home.stateVersion = "24.05";
  home.sessionVariables = {
    EDITOR = "vim";
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

  home.packages = with pkgs; [
    btop
    lazygit
    gh
    inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.omp
  ];
}
