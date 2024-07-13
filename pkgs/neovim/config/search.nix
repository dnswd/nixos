{
  my,
  pkgs,
  inputs,
  mkKey,
  ...
}: let

  inherit (my) mkKeymap mkKeymap';
  mkPkgs = name: src: pkgs.vimUtils.buildVimPlugin {inherit name src;};

in {

  plugins.flash = {
    enable = true;
    settings.search.mode = "fuzzy";
  };

  plugins.harpoon = {
    enable = true;
    enableTelescope = true;
  };

  plugins.telescope = {
    enable = true;
    extensions = {
      fzf-native.enable = true;
      undo.enable = true;
    };
  };

}
