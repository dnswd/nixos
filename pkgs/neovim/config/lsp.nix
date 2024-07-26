{
  my,
  helpers,
  ...
}: let
  
  # Define keybindings in Nix
  keymaps = [
    {
      key = "<Leader>r";
      action = "vim.lsp.buf.rename()";
      options = { silent = true; noremap = true; desc = "Rename symbol"; };
    }
    {
      key = "<Leader>a";
      action = "vim.lsp.buf.code_action()";
      options = { silent = true; noremap = true; desc = "Code action"; };
    }
    {
      key = "<Leader>f";
      action = "function() vim.lsp.buf.format({ timeout_ms = 5000 }) end";
      options = { silent = true; noremap = true; desc = "Format code"; };
    }
    {
      key = "gd";
      action = "vim.lsp.buf.definition()";
      options = { silent = true; noremap = true; desc = "Go to definition"; };
    }
    {
      key = "gD";
      action = "vim.lsp.buf.declaration()";
      options = { silent = true; noremap = true; desc = "Go to declaration"; };
    }
    {
      key = "gI";
      action = "vim.lsp.buf.implementation()";
      options = { silent = true; noremap = true; desc = "Go to implementation"; };
    }
    {
      key = "gr";
      action = "vim.lsp.buf.references()";
      options = { silent = true; noremap = true; desc = "List references"; };
    }
    {
      key = "<Leader>D";
      action = "vim.lsp.buf.type_definition()";
      options = { silent = true; noremap = true; desc = "Go to type definition"; };
    }
    {
      key = "<Leader>s";
      action = "require('telescope.builtin').lsp_document_symbols()";
      options = { silent = true; noremap = true; desc = "Document symbols"; };
    }
    {
      key = "<Leader>S";
      action = "require('telescope.builtin').lsp_workspace_symbols()";
      options = { silent = true; noremap = true; desc = "Workspace symbols"; };
    }
    {
      key = "K";
      action = "vim.lsp.buf.hover()";
      options = { silent = true; noremap = true; desc = "Hover documentation"; };
    }
  ];

in {

  # Language LSPs
  imports = my.importFrom ../lang;

  plugins.lsp = {
    enable = true;
    capabilities = "capabilities = require('cmp_nvim_lsp').default_capabilities(capabilities)";
    onAttach = # Lua
      ''
      local bufmap = function(keys, func, opts)
        opts = opts or { buffer = bufnr }
        vim.keymap.set('n', keys, func, opts)
      end

      local keymaps = ${helpers.toLuaObject keymaps}

      for _, mapping in ipairs(keymaps) do
        bufmap(mapping.key, mapping.action, mapping.options)
      end

      vim.api.nvim_buf_create_user_command(bufnr, 'Format', function(_)
        vim.lsp.buf.format()
      end, {})
      '';
  };

  # LSP langs embedded in documents/other lang
  plugins.otter.enable = true;

  # Typescript helper
  plugins.typescript-tools = {
    enable = true;
    settings.jsxCloseTag.enable = true; # Auto close tags
  };

}
