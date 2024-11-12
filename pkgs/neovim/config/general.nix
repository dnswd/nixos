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
        # gitsigns = true;
        treesitter = true;
        # notify = true;
        harpoon = true;
        # neotree = true;
        # noice = true;
        # telescope = { enabled = true; };
        # which_key = true;
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

  extraConfigLuaPre = # Lua
    ''
      vim.o.undodir = vim.fn.expand("~/.vim/undodir");
      
      function tprint (tbl, indent)
          if not indent then indent = 0 end
          for k, v in pairs(tbl) do
            formatting = string.rep("  ", indent) .. k .. ": "
            if type(v) == "table" then
              print(formatting)
              tprint(v, indent+1)
            elseif type(v) == 'boolean' then
              print(formatting .. tostring(v))		
            else
              print(formatting .. v)
            end
          end
        end
    '';

  opts = {
    # Always show sugn column
    signcolumn = "yes";

    # Enable pasting with system clipboard
    clipboard = "unnamedplus";

    # Line numbers
    number = true;
    relativenumber = true;

    # Tabs 
    tabstop = 4;
    softtabstop = 4;
    shiftwidth = 4;
    smarttab = true;
    expandtab = true; # use spaces

    # Indentation
    smartindent = true;
    breakindent = true; # auto indent when breaking

    # Disable wrapping 
    wrap = false;

    # Disable folding
    foldenable = false;

    # Disable backup
    swapfile = false;
    backup = false;

    # Long running undo file
    # Undodir configured above using extraConfgLuaPre to resolve home path
    undofile = true;

    # Disable search highlight but enable incremental search
    hlsearch = false;
    incsearch = true;

    # Colors
    termguicolors = true;

    # Scroll threshold
    scrolloff = 8; # numbers of line to keep above/below cursor
    sidescrolloff = 8; # numbers of line to keep left/right of cursor

    updatetime = 50;
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
    # Enable lazy loading
    lazy.enable = true;

    # Enable error lens
    trouble.enable = true;

    # Auto close bracket
    nvim-autopairs.enable = true;

    # Lazygit integration
    lazygit.enable = true;

    # Git signs
    gitsigns.enable = true;
    gitsigns.settings.current_line_blame = true;

    # Icons
    web-devicons.enable = true;

    # which_key
    which-key.enable = true;
  };

  # Lua helper
  extraPlugins = with pkgs.vimPlugins; [
    plenary-nvim
  ];

}
