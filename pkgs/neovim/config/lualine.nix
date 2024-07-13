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

  plugins.lualine = {
    enable = true;
    globalstatus = true;
    theme = "palenight";
    sections = { 
      lualine_c = [ "lsp_progress" ]
    };
  };

}
