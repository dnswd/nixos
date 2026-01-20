{ pkgs, ... }: {

  catppuccin = {
    enable = true;
    flavor = "mocha";
    accent = "blue";
    gtk.icon.enable = true;
  };

  gtk.enable = true;

}
