{...}: {

  # Other plugins for support
  plugins = {
    cmp-nvim-lsp.enable = true;
    cmp-buffer.enable = true;
    cmp_luasnip.enable = true;
    cmp-async-path.enable = true;

    # Non-cmp plugins
    luasnip.enable = true;
    friendly-snippets.enable = true;
    lspkind = {
      enable = true;
      menu = {
        luasnip = "[Snip]";
        nvim_lsp = "[LSP]";
        buffer = "[Buff]";
        async_path = "[Path]";
      };
      cmp = {
        enable = true;
        after = # lua
          ''
          function(entry, vim_item, kind)
            return vim_item
          end
          '';
      };
    };
  };

  plugins.cmp = {
    enable = true;
    autoEnableSources = true;
    settings = {
      sources = [
        { name = "nvim_lsp"; }
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
        "<C-b>" = "cmp.mapping.scroll_docs(-4)";
        "<C-f>" = "cmp.mapping.scroll_docs(4)";
        "<C-Space>" = "cmp.mapping.complete()";
        "<C-e>" = "cmp.mapping.abort()";
        "<CR>" = "cmp.mapping.confirm({ select = false })";
      };
    };
  };
}
