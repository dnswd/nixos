{ pkgs, osType, hostname, ... }:
{
  imports = [
    ../config/devel/jetbrains.nix
  ];

  home.username = "oydennisalbaihaqi";
  home.homeDirectory = 
    if osType == "darwin"
    then "/Users/oydennisalbaihaqi"
    else "/home/oydennisalbaihaqi";
  
  home.stateVersion = "24.05";

  programs.home-manager.enable = true;

  home.sessionVariables = {
    EDITOR = "vim";
  };

  home.packages = with pkgs; [
    btop
  ];
}
