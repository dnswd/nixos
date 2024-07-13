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

  plugins.neo-tree = {
    enable = true;
    filesystem.filteredItems = {
      hideDotfiles = false;
      hideGitignored = false;
      visible = true;
    };
  };

}
