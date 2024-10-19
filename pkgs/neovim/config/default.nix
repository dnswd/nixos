{
  pkgs,
  ...
}: {

  viAlias = true;
  vimAlias = true;

  # Disable providers
  withRuby = false;

  colorschemes.catppuccin = {
    enable = true;
    settings = {
      flavor = "macchiato";
      integrations = {
        cmp = true;
        gitsigns = true;
        treesitter = true;
        notify = true;
        harpoon = true;
        neotree = true;
        noice = true;
        telescope = { enabled = true; };
        which_key = true;
      };
      transparent_background = true;
      background = {
        dark = "macchiato";
        light = "macchiato";
      };

    };
  };

  globals = {
    mapleader = " ";
    maplocalleader = " ";
  };   

  opts = {
    signcolumn = "yes";

    # Use spaces instead tabs
    shiftwidth = 2;
    smarttab = true;
    expandtab = true;
    
    updatetime = 300;
    mouse = "a";
  };

  diagnostics = {
    signs = {
      text = {
        "[vim.diagnostic.severity.ERROR]" = "✘";
        "[vim.diagnostic.severity.WARN]" = "▲";
        "[vim.diagnostic.severity.HINT]" = "⚑";
        "[vim.diagnostic.severity.INFO]" = "»";
      };
    };
  };

  plugins = {
    # # Enable lazy loading
    lazy.enable = true;
    #
    # # Enable error lens
    trouble.enable = true;
    #
    # # Auto close bracket
    nvim-autopairs.enable = true;
  };

  # Lua helper
  extraPlugins = with pkgs.vimPlugins; [
    plenary-nvim
  ];

}
