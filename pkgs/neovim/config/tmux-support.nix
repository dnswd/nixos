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

  plugins = {
    tmux-navigator.enable = true;
  };

  extraPlugins = with pkgs.vimPlugins; [
    vim-tmux-clipboard
  ];

}
