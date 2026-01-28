{
  pkgs,
  inputs,
  ...
}:
{
  imports = [
    ../config/zsh
    ../config/kitty.nix
    ../config/notification.nix
    ../config/scripts.nix
    ../config/starship.nix
    ../config/theme.nix
    ../config/tmux.nix
    ../config/devel
    ../config/bitwarden.nix
  ];

  # Home Manager needs a bit of information about you and the
  # paths it should manage.
  home.username = "halcyon";
  home.homeDirectory = "/home/halcyon";

  # This value determines the Home Manager release that your
  # configuration is compatible with. This helps avoid breakage
  # when a new Home Manager release introduces backwards
  # incompatible changes.
  #
  # You can update Home Manager without changing this value. See
  # the Home Manager release notes for a list of state version
  # changes in each release.
  home.stateVersion = "24.05";

  # Let Home Manager install and manage itself.
  programs.home-manager.enable = true;

  # Variables
  home.sessionVariables = {
    TERMINAL = "kitty";
    BROWSER = "firefox";
    TERM = "screen-256color";
  };

  # Session Paths (TODO)
  # home.sessionPath = "";

  # Manage shell aliases, if you need to enable zsh feature use `programs.zsh.shellAliases`.
  home.shellAliases = {
    clear = # bash
      ''printf "\033[2J\033[3J\033[1;1H"'';
  };

  # XDG
  xdg = {
    enable = true;
    mime.enable = true;
    userDirs.enable = true;
    userDirs.createDirectories = true;
  };

  home.packages = with pkgs; [
    google-chrome

    # debug configs
    nix-inspect

    # recording
    obs-studio

    # proton launcher for non-steam games
    steamtinkerlaunch

    # image editing
    gimp

    # ai
    amp-cli
  ];
}
