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

  plugins.notify = {
    enable = true;
  };

}
