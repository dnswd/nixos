{ my, ... }:let
  inherit (my) importFrom;
in {

  # Import language server settings
  imports = importFrom ../lang;

  plugins.lsp = {
    enable = true;
    capabilities = "capabilities = require('cmp_nvim_lsp').default_capabilities(capabilities)";
    keymaps = {
      silent = true;
      diagnostic = {
        # Navigate in diagnostics
        "<leader>vd" = "open_float";
        "<leader>k" = "goto_prev";
        "<leader>j" = "goto_next";
      };

      lspBuf = {
        K = "hover";
        gd = "definition";
        gD = "references";
        gi = "implementation";
        gt = "type_definition";
        gs = "signature_help";
        "<F2>" = "rename";
        "<F4>" = "code_action";
      };

      extra = [
        {
          mode = ["n" "x"];
          key = "<F3>";
          action = "<cmd>lua vim.lsp.buf.format({async = true})<cr>";
        }
      ];
    };
  };

  plugins.lsp-format = {
    enable = true;
    lspServersToEnable = "all";
  };

  plugins.otter = {
    enable = true;
    autoActivate = true;
  };

}
