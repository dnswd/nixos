{
  pkgs,
  ...
}: {

  viAlias = true;
  vimAlias = true;

  colorschemes.catppuccin.enable = true;

  globals = {
    mapleader = " ";
    maplocalleader = " ";
  };

  opts = {
    signcolumn = "yes";
    tabstop = 4;
    softtabstop = 2;
    shiftwidth = 2;
    updatetime = 300;
    mouse = "a";
  };

  plugins = {
    # Enable lazy loading
    lazy.enable = true;

    # Enable error lens
    trouble.enable = true;
  };

  # Lua helper
  extraPlugins = with pkgs.vimPlugins; [
    plenary-nvim
  ];

}
