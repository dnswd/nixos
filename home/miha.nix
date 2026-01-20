{ pkgs
, inputs
, ...
}: {
  imports = [
    ../config/zsh
    ../config/hyprland
    ../config/ghostty.nix
    ../config/mako.nix
    ../config/scripts.nix
    ../config/starship.nix
    ../config/theme.nix
    ../config/waybar
    ../config/wofi.nix
    ../config/tmux.nix
    ../config/devel
  ];

  home.username = "miha";
  home.homeDirectory = "/home/miha";

  home.stateVersion = "24.05";

  programs.home-manager.enable = true;

  home.sessionVariables = {
    TERMINAL = "kitty";
    BROWSER = "firefox";
  };

  home.shellAliases = {
    clear = # bash
      ''printf "\033[2J\033[3J\033[1;1H"'';
  };

  xdg = {
    enable = true;
    mime.enable = true;
    userDirs.enable = true;
    userDirs.createDirectories = true;
  };

  home.packages = with pkgs; [
    firefox
    kitty
  ];
}
