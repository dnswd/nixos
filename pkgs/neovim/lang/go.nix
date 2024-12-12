{ pkgs, ... }:
let
  buildFlags = "-tags=unit,integration,e2e,bdd,dind";
in
{
  plugins.lsp.servers.gopls = {
    enable = true;
    extraOptions.settings = {
      gopls = {
        buildFlags = [ buildFlags ];
        staticcheck = true;
        directoryFilters = [ "-.git" "-.vscode" "-.idea" "-.vscode-test" "-node_modules" ];
        semanticTokens = true;
        codelenses = {
          gc_details = false;
          generate = true;
          regenerate_cgo = true;
          run_govulncheck = true;
          test = true;
          tidy = true;
          upgrade_dependency = true;
          vendor = true;
        };

        hints = {
          assignVariableTypes = false;
          compositeLiteralFields = false;
          compositeLiteralTypes = false;
          constantValues = true;
          functionTypeParameters = true;
          parameterNames = true;
          rangeVariableTypes = false;
        };
        analyses = {
          assign = true;
          bools = true;
          defers = true;
          deprecated = true;
          fieldalignment = true;
          tests = true;
          nilness = true;
          httpresponse = true;
          unmarshal = true;
          unusedparams = true;
          unusedwrite = true;
          useany = true;
        };
      };
    };
  };

  # go.nvim
  extraPlugins = [ pkgs.vimPlugins.go-nvim ];
  extraConfigLua = # lua
    ''
      require('go').setup()
    '';
}
