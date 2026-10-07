{ pkgs, ... }:
{

  catppuccin = {
    enable = true;
    flavor = "mocha";
    accent = "blue";
    gtk.icon.enable = pkgs.stdenv.isLinux;
    obsidian.enable = false; # use obsidian-configured theme
  };

  gtk.enable = pkgs.stdenv.isLinux;
}
