{ my, ... }:
let
  inherit (my) importFrom;
in
{

  # Import language server settings
  imports = importFrom ../lang;

  plugins.lsp = {
    enable = true;
    inlayHints = true;
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
        gd = "definition"; # go definitions
        gD = "declaration"; # go Declaration
        gi = "implementation"; # go implementation
        gt = "type_definition"; # go to type
        gr = "references"; # go references
        K = "hover"; # quick Knowledge
        "<C-k>" = "signature_help"; # Knowledge
        "<leader>rn" = "rename"; # rename
        "<leader>ca" = "code_action"; # code action
      };
      extra = [
        {
          mode = [ "n" "x" ];
          key = "<leader>f"; # format
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
    # autoActivate = true;
  };

}
