{
  my,
  helpers,
  ...
}: let
  
  # Define keybindings in Nix
  keymaps = [
    {
      key = "<Leader>r";
      action = /* lua */ "vim.lsp.buf.rename()";
      options = { silent = true; noremap = true; desc = "Rename symbol"; };
    }
    {
      key = "<Leader>a";
      action = /* lua */ "vim.lsp.buf.code_action()";
      options = { silent = true; noremap = true; desc = "Code action"; };
    }
    {
      key = "<Leader>f";
      action = /* lua */ "vim.lsp.buf.format({ timeout_ms = 5000 })";
      options = { silent = true; noremap = true; desc = "Format code"; };
    }
    {
      key = "gd";
      action = /* lua */ "vim.lsp.buf.definition()";
      options = { silent = true; noremap = true; desc = "Go to definition"; };
    }
    {
      key = "gI";
      action = /* lua */ "vim.lsp.buf.implementation()";
      options = { silent = true; noremap = true; desc = "Go to implementation"; };
    }
    {
      key = "<C-D>";
      action = /* lua */ ''
      vim.lsp.buf_request(0, "textDocument/definition", vim.lsp.util.make_position_params(), function(err, result) 
        if not err and result and not vim.tbl_isempty(result) and result[1].range then 
          local current_pos = vim.api.nvim_win_get_cursor(0) 
          local def = result[1].range.start 
          if def.line == current_pos[1] - 1 and def.character == current_pos[2] then 
            require("telescope.builtin").lsp_references() 
          else 
            if #result > 1 then 
              require("telescope.builtin").lsp_locations({ results = result, prompt_title = "Definitions" }) 
            else 
              vim.lsp.util.jump_to_location(result[1]) 
            end 
          end 
        else 
          require("telescope.builtin").lsp_references() 
        end 
      end)
  '';
      options = { silent = true; noremap = true; desc = "Go to declaration/usages"; };
    }
    {
      key = "<S-D>";
      action = /* lua */ "vim.lsp.buf.type_definition()";
      options = { silent = true; noremap = true; desc = "Go to type definition"; };
    }
    {
      key = "<Leader>s";
      action = /* lua */ "require('telescope.builtin').lsp_document_symbols()";
      options = { silent = true; noremap = true; desc = "Document symbols"; };
    }
    {
      key = "<Leader>S";
      action = /* lua */ "require('telescope.builtin').lsp_workspace_symbols()";
      options = { silent = true; noremap = true; desc = "Workspace symbols"; };
    }
    {
      key = "K";
      action = /* lua */ "vim.lsp.buf.hover()";
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
        bufmap(mapping.key, loadstring(mapping.action), mapping.options)
      end

      vim.api.nvim_buf_create_user_command(bufnr, 'Format', function(_)
        vim.lsp.buf.format()
      end, {})
      '';
  };

  # LSP langs embedded in documents/other lang
  plugins.otter.enable = true;

}
