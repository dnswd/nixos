{ pkgs, ... }: {

  catppuccin = {
    enable = true;
    flavor = "mocha";
    accent = "blue";
    gtk.icon.enable = pkgs.stdenv.isLinux;
  };

  gtk.enable = pkgs.stdenv.isLinux;
}
