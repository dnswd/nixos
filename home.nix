{ config, pkgs, ... }:

{
  # Home Manager needs a bit of information about you and the
  # paths it should manage.
  home.username = "halcyon";
  home.homeDirectory = "/home/halcyon";

  # This value determines the Home Manager release that your
  # configuration is compatible with. This helps avoid breakage
  # when a new Home Manager release introduces backwards
  # incompatible changes.
  #
  # You can update Home Manager without changing this value. See
  # the Home Manager release notes for a list of state version
  # changes in each release.
  home.stateVersion = "24.05";

  # Let Home Manager install and manage itself.
  programs.home-manager.enable = true;
  
  # Variables
  home.sessionVariables = {
    TERMINAL = "kitty";
    BROWSER = "firefox";
    TERM = "screen-256color";
  };

  # Session Paths (TODO)
  # home.sessionPath = "";

  # Manage shell aliases, if you need to enable zsh feature use `programs.zsh.shellAliases`.
  home.shellAliases = {
    clear = /* Bash */ ''printf "\033[2J\033[3J\033[1;1H"'';
  };
  
  # XDG
  xdg = {
    enable = true;
    mime.enable = true;
    userDirs.enable = true;
    userDirs.createDirectories = true;
  };
  
  # Catppuccin theme
  catppuccin.flavor = "mocha";
  
  # Mise
  programs.mise = {
    enable = true;
    enableZshIntegration = true;
  };
  
  # Kitty
  programs.kitty = {
    enable = true;
    catppuccin.enable = true;
    font.name = "FantasqueSansM Nerd Font";
    font.size = 12;
    settings = {
      confirm_os_window_close = 0;
      enable_audio_bell = false;
      allow_remote_control = true;
      copy_on_select = true;
      window_padding_width = "1 5"; # vertical horizontal
      background_opacity = "0.8";
      cursor_text_color = "background";
      disable_ligatures = "cursor";
      
      # Font
      font_family = "FantasqueSansM Nerd Font";
      bold_font = "auto";
      italic_font = "auto";
      bold_italic_font = "auto";
    };
    keybindings = {
      "cmd+w" = "no_op";
      "cmd+t" = "no_op";
      "cmd+enter" = "no_op";
    };
  };
  
  # Git
  # https://nix-community.github.io/home-manager/options.xhtml#opt-programs.git.enable
  programs.git = {
    enable = true;
    userName = "Dennis Al Baihaqi Walangadi";
    userEmail = "dennis.walangadi@gmail.com";
    aliases = {
      # commit
      c = "commit"; # commit
      cm = "commit -m"; # commit with message
      ca = "commit -am"; # commit all with message
      amend = "commit --amend"; # ammend your last commit
      append = "commit --amend --no-edit"; # append changes into your last commit

      # branch
      recent-branches = "!git for-each-ref --count=5 --sort=-committerdate refs/heads/ --format='%(refname:short)'";
      nb = "checkout -b";
      sw = "switch";
      pl = "pull";
      ps = "push";
      # mt = "mergetool"; # fire up the merge tool

      # rebase
      rc = "rebase --continue"; # continue rebase
      rs = "rebase --skip"; # skip rebase

      # remote
      r = "remote -v"; # show remotes (verbose)
    };
    extraConfig = {
      core = {
        editor = "nvim";
        autocrlf = "input";
      };
      
      # Force SSH on GitHub
      url."git@github.com:".insteadOf = "https://github.com/";
      
      # Pull request stuffs
      pull = {
        ff = "only";
        rebase = false;
      };
      
      # Pretty diff
      diff.algorithm = "histogram";
      
      # Disable safedir, only do this if you're the sole user of the machine
      safe.directory = "*";
    };

    # Enable 'delta' git diff viewer
    delta = {
      enable = true;
    };
  };
  
  # Zsh
  programs.zsh = {
    enable = true;
    defaultKeymap = "viins";
    dotDir = ".config/zsh";
    # initExtraFirst = builtins.readFile ~/.config/zsh/initExtraFirst.zsh;
    
    # Quality of life
    autocd = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;
    historySubstringSearch.enable = true;
    history = {
      ignoreDups = true;
      ignoreSpace = true;
      path = "$ZDOTDIR/.history";
      share = true;
    };

    envExtra = builtins.concatStringsSep "\n" [
      "ZSH_TMUX_AUTOSTART=true" # Autostart tmux
    ];

    shellAliases = {
      # use zoxide by default
      cd = "z";
    };
    
    initExtra = /* Bash */ ''
      # Case insensitive completion
      zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
      
      # Completion colors based on 'ls --color'
      zstyle ':completion:*' list-colors ''${(s.:.)LS_COLORS}
      
      # Disable default completion menu to be replaced with fzf
      zstyle ':completion:*' menu no
      zstyle '"fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
      zstyle '"fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

      # Autostart tmux
      if [ -x "$(command -v tmux)" ] && [ -n "''${DISPLAY}" ] && [ -z "''${TMUX}" ]; then
          exec tmux new-session -A -s ''${USER} >/dev/null 2>&1
      fi
      '';
    
    plugins = [
      {
        name = "zsh-fzf-tab";
        file = "fzf-tab.plugin.zsh";
        src = "${pkgs.zsh-fzf-tab}/share/fzf-tab";
      }
    ];
  };
  
  # Starship prompt
  programs.starship = {
    enable = true;
    catppuccin.enable = true;

    # All supported shells are enabled by default
    # Disable unused shells
    enableFishIntegration = false;
    enableIonIntegration = false;
    enableNushellIntegration = false;

    settings = {
      character = {
        success_symbol = "[λ](bold green)";
        error_symbol = "[λ](bold red)";
      };

      cmd_duration = {
        min_time = 500;
      };
    };
  };
  
  # Fuzzy finder
  programs.fzf = {
    enable = true;
  };

  # Regex find directory
  programs.ripgrep.enable = true;

  # Fuzzy find directory
  programs.fd = {
    enable = true;
    ignores = [ ".git/*" "node_modules/*" ];
  };
  
  # Zoxide for fuzzy cd
  programs.zoxide = {
    enable = true;
    enableZshIntegration = true;
  };
  
  # Tmux
  programs.tmux = {
    enable = true;
    catppuccin.enable = true;
    prefix = "C-Space"; # use Ctrl+Space as prefix
    clock24 = true;
    mouse = true;
    baseIndex = 1;
    shell = "${pkgs.zsh}/bin/zsh";
    sensibleOnTop = true;
    terminal = "screen-256color";
    extraConfig = /* sh */ ''
      set-option -g renumber-windows on
      
      # Fix tmux color (use 24 color when terminal support it)
      set-option -sa terminal-overrides ",xterm*:Tc"
      
      # Better copy flow (vi)
      set-window-option -g mode-keys vi # set vi-mode
      bind-key -T copy-mode-vi v send-keys -X begin-selection # start selection
      bind-key -T copy-mode-vi C-v send-keys -X rectangle-toggle # toggle line/block select
      bind-key -T copy-mode-vi y send-keys -X copy-selection-and-cancel # yank

      # List sessions
      bind-key -T prefix l choose-tree -Zs

      # Allow xterm keys, for tab-like controls
      set-option -gw xterm-keys on
     
      # Shift+Alt+H/L to switch windows
      bind -n M-H previous-window
      bind -n M-L next-window
      
      # Chrome tab-like window switching
      bind -n M-T new-window
      bind -n M-W confirm-before -p "kill-window #W? (y/n)" kill-window

      # Open panes in cwd
      bind -n M-'\' split-window -h -c "#{pane_current_path}"
      bind -n M-'-' split-window -v -c "#{pane_current_path}"
      bind -n M-P confirm-before -p "kill-pane #P? (y/n)" kill-pane
      
      # Expand pane
      bind -n M-z resize-pane -Z

      # Select pane with Alt+vi
      bind -n M-k select-pane -U
      bind -n M-j select-pane -D
      bind -n M-h select-pane -L
      bind -n M-l select-pane -R

      # Enter copy mode
    '';

    plugins = with pkgs; [
      tmuxPlugins.vim-tmux-navigator
      tmuxPlugins.yank
    ];
  };
  
  programs.neovim = {
    enable = true;
    viAlias = true;
    vimAlias = true;
    vimdiffAlias = true;
    defaultEditor = true;
    
    catppuccin.enable = true;
    
    extraPackages = with pkgs; [
      lua54Packages.jsregexp # luasnip dependency
      lua-language-server
      nil

      # Clipboard dependency
      xclip
      wl-clipboard

      # Tree sitter dependency
      tree-sitter
      nodejs_22

      # LSP dependencies
      elixir-ls
    ];

    extraLuaPackages = ps: [
      ps.jsregexp
    ];
    
    plugins = with pkgs.vimPlugins; [
      # Tmux support
      vim-tmux-navigator
      vim-tmux-clipboard

      ###############
      # NVIM Config #
      ###############

      # Base config
      neodev-nvim

      # Cosmetics
      lualine-nvim
      nvim-web-devicons

      # File tree
      oil-nvim

      ############
      # Language #
      ############

      # LSP for embedded langs
      otter-nvim

      # Comment context for Comment.nvim
      nvim-ts-context-commentstring

      # LSP Lang Support
      {
        plugin = nvim-treesitter.withAllGrammars;
        type = "lua";
        config = /* Lua */ ''
          require('nvim-treesitter.configs').setup {
            ensure_installed = {},
            auto_install = false,
            highlight = { enable = true },
            indent = { enable = true },
          }
        '';
      }
      rust-tools-nvim
      vim-nix

      # LSP Config
      {
        plugin = nvim-lspconfig;
        type = "lua";
        config = /* Lua */ '' 
          
          -- LSP server config for each LS
          local servers = {
            -- Python
            pylsp = {
              settings = {
                pylsp = {
                  plugins = {
                    pycodestyle = {
                      ignore = { 'E501' }
                    }
                  }
                }
              }
            },

            -- Rust
            rust_analyzer = {
              cmd = { "rust-analyzer" },
              tools = { autoSetHints = true },
              setup = function(ops)
                local rust_tools = require('rust-tools')
                rust_tools.setup(opts)
              end
            },

            -- Nix
            nil_ls = {},

            -- Bash
            bashls = {},

            -- C / C++
            clangd = {},

            -- Dart
            dartls = {},

            -- Docker
            dockerls = {},

            -- Go
            gopls = {},

            -- Haskell
            hls = {},

            -- Java
            jdtls = {},

            -- Kotlin
            kotlin_language_server = {},

            -- Lua
            lua_ls = {},

            -- Ruby
            solargraph = {},

            -- Terraform
            terraformls = {},
            
            -- TeX
            texlab = {
              chktex = {
                onEdit = true,
                onOpenAndSave = true
              }
            },

            -- Typescript
            tsserver = {},

            -- Elixir
            elixirls = { cmd = {"elixir-ls"} },
          }

          local on_attach = function(_, bufnr)

            local bufmap = function(keys, func)
              vim.keymap.set('n', keys, func, { buffer = bufnr })
            end
        
            bufmap('<Leader>r', vim.lsp.buf.rename)
            bufmap('<Leader>a', vim.lsp.buf.code_action)
            bufmap('<Leader>f', function() vim.lsp.buf.format({ timeout_ms = 5000 }) end)

            bufmap('gd', vim.lsp.buf.definition)
            bufmap('gD', vim.lsp.buf.declaration)
            bufmap('gI', vim.lsp.buf.implementation)
            bufmap('gr', vim.lsp.buf.references)
            bufmap('<Leader>D', vim.lsp.buf.type_definition)
  
            bufmap('gr', require('telescope.builtin').lsp_references)
            bufmap('<Leader>s', require('telescope.builtin').lsp_document_symbols)
            bufmap('<Leader>S', require('telescope.builtin').lsp_dynamic_workspace_symbols)

            bufmap('K', vim.lsp.buf.hover)

            vim.api.nvim_buf_create_user_command(bufnr, 'Format', function(_)
              vim.lsp.buf.format()
            end, {})
          end

          local capabilities = vim.lsp.protocol.make_client_capabilities()
          capabilities = require('cmp_nvim_lsp').default_capabilities(capabilities)

          local opts = { noremap = true, silent = true }
          
          vim.api.nvim_set_keymap("n", "ge", ':lua vim.diagnostic.open_float(0, { scope = "line", border = "single" })<CR>', opts)
          vim.api.nvim_set_keymap("n", "[d", ":lua vim.diagnostic.goto_prev()<CR>", opts)
          vim.api.nvim_set_keymap("n", "]d", ":lua vim.diagnostic.goto_next()<CR>", opts)
          vim.api.nvim_set_keymap("n", "<space>q", ":lua vim.diagnostic.setloclist()<CR>", opts)

          -- Attach key mapping to each LS
          local nvim_lsp = require('lspconfig')
          for server, extra_args in pairs(servers) do
            local args = {
              on_attach = on_attach,
              capabilities = capabilities,
              flags = {
                debounce_text_changes = 150,
              }
            }

            -- Apply Lang LSP args
            for key, val in pairs(extra_args) do
              args[key] = val
            end

            -- Check if server contains executables
            local cmd = args.cmd or nvim_lsp[server].document_config.default_config.cmd
            if vim.fn.executable(cmd[1]) == 1 then
              nvim_lsp[server].setup(args)
            end
          end
        '';
      }

      ###########################
      # Quality of life plugins #
      ###########################

      # Comment toggle
      {
        plugin = comment-nvim;
        type = "lua";
        config = /* Lua */ "require(\"Comment\").setup()";
      }
      
      # Completions
      cmp_luasnip
      cmp-nvim-lsp
      {
        plugin = nvim-cmp;
        type = "lua";
        config = /* Lua */ ''
          local cmp = require('cmp')
          local luasnip = require('luasnip')

          require('luasnip.loaders.from_vscode').lazy_load()
          luasnip.config.setup {}

          cmp.setup {
              snippet = {
                  expand = function(args)
                      luasnip.lsp_expand(args.body)
                  end,
              },
              mapping = cmp.mapping.preset.insert {
                  ['<C-n>'] = cmp.mapping.select_next_item(),
                  ['<C-p>'] = cmp.mapping.select_prev_item(),
                  ['<C-d>'] = cmp.mapping.scroll_docs(-4),
                  ['<C-f>'] = cmp.mapping.scroll_docs(4),
                  ['<C-Space>'] = cmp.mapping.complete {},
                  ['<CR>'] = cmp.mapping.confirm {
                      behavior = cmp.ConfirmBehavior.Replace,
                      select = true,
                  },
                  ['<Tab>'] = cmp.mapping(function(fallback)
                      if cmp.visible() then
                          cmp.select_next_item()
                      elseif luasnip.expand_or_locally_jumpable() then
                          luasnip.expand_or_jump()
                      else
                          fallback()
                      end
                  end, { 'i', 's' }),
                  ['<S-Tab>'] = cmp.mapping(function(fallback)
                      if cmp.visible() then
                          cmp.select_prev_item()
                      elseif luasnip.locally_jumpable(-1) then
                          luasnip.jump(-1)
                      else
                          fallback()
                      end
                  end, { 'i', 's' }),
              },
              sources = {
                  { name = 'nvim_lsp' },
                  { name = 'luasnip' },
              },
          }
        '';
      }

      # Search
      {
        plugin = telescope-nvim;
        type = "lua";
        config = /* Lua */ ''
          require('telescope').setup({
           	extensions = {
             	fzf = {
                  fuzzy = true,                    -- false will only do exact matching
                  override_generic_sorter = true,  -- override the generic sorter
                  override_file_sorter = true,     -- override the file sorter
                  case_mode = "smart_case",        -- or "ignore_case" or "respect_case"
                                                   -- the default case_mode is "smart_case"
             	}
           	}
          })

          require('telescope').load_extension('fzf')
        '';
      }
      telescope-fzf-native-nvim


      # Snippets
      luasnip
      friendly-snippets
    ];
    
    extraLuaConfig = /* Lua */ ''

      -- Set leader key to <space>
      vim.keymap.set("", "<space>", "<nop>", { silent = true })
      vim.g.mapleader = " "
      vim.g.maplocalleader = " "

      -- Options
      vim.o.clipboard = 'unnamedplus'
      vim.o.number = true
      vim.o.signcolumn = 'yes'
      vim.o.tabstop = 4
      vim.o.shiftwidth = 4
      vim.o.updatetime = 300
      vim.o.termguicolors = true
      vim.o.mouse = 'a'

      -- Enable relative number only when entering normal mode
      local function enable_relative_number()
        vim.opt.relativenumber = true
      end

      local function disable_relative_number()
        vim.opt.relativenumber = false
      end

      vim.api.nvim_create_autocmd({"BufEnter", "InsertLeave"}, {
        pattern = "*",
        callback = enable_relative_number,
      })

      vim.api.nvim_create_autocmd("InsertEnter", {
        pattern = "*",
        callback = disable_relative_number,
      })
    '';
  };
}

