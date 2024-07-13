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

  # extraPlugins = with pkgs.vimPlugins; [
  #   {
  #     plugin = nvim-web-devicons;
  #     type = "lua";
  #     config =
  #       # Lua
  #       ''
  #         require('nvim-web-devicons').setup({})
  #       '';
  #   }
  # ];

}
