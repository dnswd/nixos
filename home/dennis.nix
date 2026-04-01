{
  pkgs,
  osType,
  hostname,
  ...
}:
{
  imports = [
    ../config/devel/pi-mono
    ../config/devel/git.nix
    ../config/devel/jetbrains.nix
    ../config/devel/langs.nix
  ];

  home.username = "oydennisalbaihaqi";
  home.homeDirectory = "/Users/oydennisalbaihaqi";
  # home.homeDirectory =
  #   if osType == "darwin"
  #   then "/Users/oydennisalbaihaqi"
  #   else "/home/oydennisalbaihaqi";

  home.stateVersion = "24.05";

  programs.home-manager.enable = true;

  home.sessionVariables = {
    EDITOR = "vim";
  };

  home.packages = with pkgs; [
    btop
  ];
}
