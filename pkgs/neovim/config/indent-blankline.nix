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

  plugins.indent-blankline = {
    enable = true;
    settings = {
      exclude = {
        filetypes = [ "help" "dashboard" "toggleterm" ];
        buftypes = [ "terminal" ];
      };
    };
  };

}
