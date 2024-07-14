{
  pkgs,
  ...
}: {

  extraPlugins = with pkgs.vimPlugins; [
    nvim-web-devicons
  ];

  extraConfigLua = "require('nvim-web-devicons').setup({})";

}
