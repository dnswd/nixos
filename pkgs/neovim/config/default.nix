{ pkgs
, ...
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

    # Line numbers
    number = true;
    relativenumber = true;

    # Tabs 
    tabstop = 4;
    softtabspot = 4;
    shiftwidth = 4;
    smartindent = true;
    # Use spaces instead tabs
    smarttab = true;
    expandtab = true;

    # Disable wrapping 
    wrap = false;

    # Disable folding
    foldenable = false;

    # Disable backup
    swapfile = false;
    backup = false;

    # Long running undo file
    undodir = ''os.getenv("HOME") .. "/.vim/undodir"'';
    undofile = true;

    # Disable search highlight but enable incremental search
    hlsearch = false;
    incsearch = true;

    # Colors
    termguicolors = true;

    # Scroll line threshold
    scrolloff = 8;

    updatetime = 50;
    mouse = "a";
  };

  # diagnostics = {
  #   signs = {
  #     text = {
  #       "[vim.diagnostic.severity.ERROR]" = "✘";
  #       "[vim.diagnostic.severity.WARN]" = "▲";
  #       "[vim.diagnostic.severity.HINT]" = "⚑";
  #       "[vim.diagnostic.severity.INFO]" = "»";
  #     };
  #   };
  # };

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
