{
  pkgs,
  ...
}:
{
  viAlias = true;
  vimAlias = true;

  colorschemes.catppuccin = {
    enable = true;
    settings = {
      flavor = "mocha";
      default_integrations = true;
      integrations = {
        cmp = true;
        treesitter = true;
        harpoon = true;
      };
      transparent_background = true;
    };
  };

  globals = {
    mapleader = " ";
    maplocalleader = " ";
    have_nerd_font = true;
  };

  clipboard = {
    providers = {
      wl-copy.enable = true; # For Wayland
      xsel.enable = true; # For X11
    };

    # Sync clipboard between OS and Neovim
    #  Remove this option if you want your OS clipboard to remain independent.
    register = "unnamedplus";
  };

  opts = {
    # Line numbers
    number = true;
    relativenumber = true;

    # Mouse mode
    mouse = "a";

    # Don't show the mode, since it's already in the statusline
    showmode = false;

    # Long running undo file
    # Undodir configured above using extraConfgLuaPre to resolve home path
    undofile = true;

    # Case-insensitive searching UNLESS \C or one or more capital letters in the search term
    ignorecase = true;
    smartcase = true;

    # Always show sign column
    signcolumn = "yes";

    # Decrease update time
    updatetime = 50;

    # Decrease mapped sequence wait time
    timeoutlen = 300;

    # How new splits should be configures
    splitright = true;
    splitbelow = true;

    # Show whitespace characters
    # list = true;
    # listchars.__raw = "{ tab = '» ', trail = '·', nbsp = '␣' }";

    # Show substitutions live, show preview with "split" disable with "nosplit"
    inccommand = "split";

    # Highlight cursor line position
    cursorline = true;

    # Minimal number of screen lines to keep above and below the cursor.
    scrolloff = 8; # numbers of line to keep above/below cursor
    sidescrolloff = 8; # numbers of line to keep left/right of cursor

    # Disable search highlight but enable incremental search
    hlsearch = false;
    incsearch = true;

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

    # Colors
    termguicolors = true;
  };

  diagnostic = {
    settings = {
      severity_sort = true;
      float = {
        border = "rounded";
        source = "if_many";
      };
      underline = {
        severity.__raw = ''vim.diagnostic.severity.ERROR'';
      };
      signs.__raw = ''
        vim.g.have_nerd_font and {
          text = {
            [vim.diagnostic.severity.ERROR] = '󰅚 ',
            [vim.diagnostic.severity.WARN] = '󰀪 ',
            [vim.diagnostic.severity.INFO] = '󰋽 ',
            [vim.diagnostic.severity.HINT] = '󰌶 ',
          },
        } or {}
      '';
      virtual_text = {
        source = "if_many";
        spacing = 2;
        format.__raw = ''
          function(diagnostic)
            local diagnostic_message = {
              [vim.diagnostic.severity.ERROR] = diagnostic.message,
              [vim.diagnostic.severity.WARN] = diagnostic.message,
              [vim.diagnostic.severity.INFO] = diagnostic.message,
              [vim.diagnostic.severity.HINT] = diagnostic.message,
            }
            return diagnostic_message[diagnostic.severity]
          end
        '';
      };
    };
  };

  plugins = {
    # Enable lazy loading
    lz-n.enable = true;

    # Enable error lens
    # trouble.enable = true;

    # Auto close bracket
    nvim-autopairs.enable = true;

    # Lazygit integration
    # lazygit.enable = true;

    # # Git signs
    # gitsigns.enable = true;
    # gitsigns.settings.current_line_blame = true;

    # Icons
    web-devicons.enable = true;

    # Guess ident
    guess-indent.enable = true;
  };

  dependencies = {
    ripgrep.enable = true;
  };

  # https://nix-community.github.io/nixvim/NeovimOptions/index.html#extraplugins
  extraPlugins = with pkgs; [
    # NOTE: This is where you would add a vim plugin that is not implemented in Nixvim, also see extraConfigLuaPre below
    vimPlugins.amp-nvim # ampcode to communicate with nvim
  ];

  # https://nix-community.github.io/nixvim/NeovimOptions/index.html#extraconfigluapost
  extraConfigLuaPost = ''
    -- vimPlugins.amp-nvim init 
    require('amp').setup({ auto_start = true, log_level = "info" })

    -- The line beneath this is called `modeline`. See `:help modeline`
    -- vim: ts=2 sts=2 sw=2 et
  '';
}
