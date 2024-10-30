{ ... }: {

  # Other plugins for support
  plugins = {
    cmp-nvim-lsp.enable = true;
    cmp-nvim-lsp-signature-help.enable = true;
    cmp-buffer.enable = true;
    cmp_luasnip.enable = true;
    cmp-async-path.enable = true;

    # Non-cmp plugins
    luasnip.enable = true;
    friendly-snippets.enable = true;
    lspkind = {
      enable = true;
      cmp = {
        enable = true;
        after = # lua
          ''
            function(entry, vim_item, kind)
              return vim_item
            end
          '';
        menu = {
          luasnip = "[Snip]";
          nvim_lsp = "[LSP]";
          buffer = "[Buff]";
          async_path = "[Path]";
        };
      };
    };
  };

  plugins.cmp = {
    enable = true;
    autoEnableSources = true;
    settings = {
      sources = [
        { name = "nvim_lsp"; }
        { name = "nvim_lsp_signature_help"; }
        { name = "async_path"; }
        { name = "buffer"; }
        { name = "luasnip"; }
      ];
      snippet = {
        expand = # lua
          ''
            function(args)
              require("luansip").expand(args.body)
            end
          '';
      };
      mapping = {
        "<C-d>" = "cmp.mapping.scroll_docs(-4)";
        "<C-f>" = "cmp.mapping.scroll_docs(4)";
        "<C-Space>" = "cmp.mapping.complete()";
        "<C-e>" = "cmp.mapping.abort()";
        "<CR>" = "cmp.mapping.confirm({ select = false })";
        "<Tab>" = # lua
          ''
            cmp.mapping(function(fallback)
              if cmp.visible() then
                cmp.select_next_item()
              else
                fallback()
              end
            end, { 'i', 's' })
          '';
        "<S-Tab>" = # lua
          ''
            cmp.mapping(function(fallback)
              if cmp.visible() then
                cmp.select_prev_item()
              else
                fallback()
              end
            end, { 'i', 's' })
          '';
      };
    };
  };
}
