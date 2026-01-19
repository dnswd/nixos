{ inputs, ... }: let 

  theme = {
    base16-theme = "kanagawa";
    vscode-theme = "Kanagawa";
  };
  
in {

  colorScheme = inputs.nix-colors.colorSchemes.${theme.base16-theme};

  gtk = {
    enable = true;
    theme = {
      name = "Adwaita:dark";
      package = pkgs.gnome-themes-extra;
    };
  };

}