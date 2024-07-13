{
  my,
  pkgs,
  inputs,
  mkKey,
  ...
}: let

  inherit (my) mkKeymap mkKeymap';
  mkPkgs = name: src: pkgs.vimUtils.buildVimPlugin {inherit name src;};

in {

  plugins.cmp = {
    enable = true;
    settings = {
      snippet = {
        expand = # Lua
          ''
          function(args)
            require('luasnip').lsp_expand(args.body)
          end
          ''
      };
      mapping = {
        "<C-n>" = "cmp.mapping.select_next_item()";
        "<C-p>" = "cmp.mapping.select_prev_item()";
        "<C-d>" = "cmp.mapping.scroll_docs(-4)";
        "<C-f>" = "cmp.mapping.scroll_docs(4)";
        "<C-Space>" = "cmp.mapping.complete {}";
        "<CR>" = # Lua
          ''
          cmp.mapping.confirm {
            behavior = cmp.ConfirmBehavior.Replace,
            select = true,
          }
          '';
        "<Tab>" = #Lua
          ''
          cmp.mapping(function(fallback)
            if cmp.visible() then
                cmp.select_next_item()
            elseif luasnip.expand_or_locally_jumpable() then
                luasnip.expand_or_jump()
            else
                fallback()
            end
          end, { 'i', 's' })
          '';
        "<S-Tab>" = #Lua
        ''
        cmp.mapping(function(fallback)
          if cmp.visible() then
            cmp.select_prev_item()
          elseif luasnip.locally_jumpable(-1) then
            luasnip.jump(-1)
          else
            fallback()
          end
        end, { 'i', 's' })
        '';
      };
      sources = [
        { name = "nvim_lsp"; } # cmp-nvim-lsp
        { name = "luasnip";  } # cmp_luasnip
        { name = "buffer";   } # cmp-buffer
        { name = "path";     } # cmp-path
        { name = "nvim_lsp_document_symbol"; } # cmp-nvim_lsp_signature_help
        { name = "nvim_lsp_signature_help"; }  # cmp-nvim_lsp_signature_help
      ];
    };
  };

  plugins.cmp-nvim-lspenable = true;
  plugins.cmp-buffer.enable = true;
  plugins.cmp-path.enable = true;
  plugins.cmp-nvim-lsp-document-symbol.enable = true;
  plugins.cmp-nvim-lsp-signature-help.enable = true;

  extraPlugins = with pkgs.vimPlugins; [
    cmp_luasnip
  ];

}
