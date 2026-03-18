{
  pkgs,
  osType,
  hostname,
  ...
}:
{
  imports = [
    ../config/devel/jetbrains.nix
    ../config/tailscale.nix
    ../config/devel/pi-mono
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
