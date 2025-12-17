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
      settings = {
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
            codeium = "[AI]";
          };
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
        { name = "codeium"; }
      ];
      snippet = {
        expand = # lua
          ''
            function(args)
              require("luasnip").lsp_expand(args.body)
            end
          '';
      };
      mapping = {
        "<C-d>" = "cmp.mapping.scroll_docs(-4)";
        "<C-f>" = "cmp.mapping.scroll_docs(4)";
        "<C-i>" = "cmp.mapping.complete()";
        "<C-e>" = "cmp.mapping.abort()";
        "<CR>" = "cmp.mapping.confirm({ select = false })";
        "<Tab>" = # lua
          ''
            cmp.mapping(function(fallback)
              if cmp.visible() then
                cmp.select_next_item()
              elseif require("luasnip").expand_or_jumpable() then
                require("luasnip").expand_or_jump()
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
              elseif require("luasnip").jumpable(-1) then
                require("luasnip").jump(-1)
              else
                fallback()
              end
            end, { 'i', 's' })
          '';
      };
      completion = {
        completeopt = "menu,menuone,noinsert,noselect";
        autocomplete = [
          "cmp.TriggerEvent.TextChanged"
          "cmp.TriggerEvent.InsertEnter"
        ];
        keyword_length = 0;
      };
    };
  };
}

