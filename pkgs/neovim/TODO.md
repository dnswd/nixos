- [ ] Shortcut jump to declaration or usages (if already at declaration, find usage)
```lua
local function go_to_declaration_or_find_usages()
  local params = vim.lsp.util.make_position_params()
  
  -- Try to find the declaration of the symbol under the cursor
  vim.lsp.buf_request(0, 'textDocument/declaration', params, function(err, result, ctx, _)
    if err or not result or vim.tbl_isempty(result) then
      -- If no declaration found, find usages instead
      vim.lsp.buf.references()
    else
      -- If declaration found, jump to it
      vim.lsp.util.jump_to_location(result[1])
    end
  end)
end

-- Keybinding to trigger the combined behavior
vim.api.nvim_set_keymap('n', '<leader>d', '<cmd>lua go_to_declaration_or_find_usages()<CR>', { noremap = true, silent = true })
```
- [ ] Shortcut to type declaration
- [ ] Shortcut to implementation
- [ ] Remap jump into `[` for backward and `]` to go forward (currently CTRL-I and CTRL-O)
- [ ] Close current tab buffer
```lua
vim.api.nvim_set_keymap('n', '<leader>bd', ':bd<CR>', { noremap = true, silent = true })
```
- [ ] Navigate between tabs 
  - [ ] Tag via harpoon https://github.com/ThePrimeagen/harpoon/issues/352#issuecomment-1841252180
  - [ ] Cycle buffer 
```lua
vim.api.nvim_set_keymap('n', '<Tab>', ':BufferLineCycleNext<CR>', { noremap = true, silent = true })
vim.api.nvim_set_keymap('n', '<S-Tab>', ':BufferLineCyclePrev<CR>', { noremap = true, silent = true })
```
  - [ ] Select with telescope
```lua
vim.api.nvim_set_keymap('n', '<leader>fb', ':Telescope buffers<CR>', { noremap = true, silent = true })
```
- [ ] Toggle harpoon current file
- [ ] Search everything all at once
```lua
local telescope = require('telescope')
local builtin = require('telescope.builtin')
local finders = require('telescope.finders')
local pickers = require('telescope.pickers')
local conf = require('telescope.config').values

local function combined_search(opts)
  opts = opts or {}
  local results = {}

  -- Collect results from find_files
  builtin.find_files({
    attach_mappings = function(_, map)
      map('i', '<CR>', function(prompt_bufnr)
        local selection = require('telescope.actions.state').get_selected_entry()
        table.insert(results, selection)
        require('telescope.actions').close(prompt_bufnr)
      end)
      return true
    end,
  })

  -- Collect results from live_grep
  builtin.live_grep({
    attach_mappings = function(_, map)
      map('i', '<CR>', function(prompt_bufnr)
        local selection = require('telescope.actions.state').get_selected_entry()
        table.insert(results, selection)
        require('telescope.actions').close(prompt_bufnr)
      end)
      return true
    end,
  })

  -- Collect results from lsp_workspace_symbols
  builtin.lsp_workspace_symbols({
    attach_mappings = function(_, map)
      map('i', '<CR>', function(prompt_bufnr)
        local selection = require('telescope.actions.state').get_selected_entry()
        table.insert(results, selection)
        require('telescope.actions').close(prompt_bufnr)
      end)
      return true
    end,
  })

  -- Show combined results in a new picker
  pickers.new(opts, {
    prompt_title = "Search Everything Results",
    finder = finders.new_table {
      results = results,
    },
    sorter = conf.generic_sorter(opts),
  }):find()
end

vim.api.nvim_set_keymap('n', '<leader>cs', ':lua combined_search()<CR>', { noremap = true, silent = true })
```
- [ ] Toggle view/hide neotree
- [ ] Mapping dismiss notification
- [ ] Mapping toggle notification history
- [ ] LSP errors window
