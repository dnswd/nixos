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

  # Language LSPs
  imports = my.importFrom ../lang;

  plugins.lsp = {
    enable = true;
    capabilities = "capabilities = require('cmp_nvim_lsp').default_capabilities(capabilities)";
    onAttach = # Lua
      ''
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
      '';
  };

  # LSP langs embedded in documents/other lang
  plugins.otter = {
    tmux-navigator.enable = true;
  };

  # JSX context for comments
  plugins.ts-context-commentstring.enable

  # Typescript helper
  plugins.typescript-tools = {
    enable = true;
    settings.jsxCloseTag.enable = true; # Auto close tags
  };

  extraPlugins = with pkgs.vimPlugins; [
    vim-tmux-clipboard
  ];

}
