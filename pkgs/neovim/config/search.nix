{
  my,
  ...
}:let 
  inherit (my) mkKeymap;
in {

  plugins.flash = {
    enable = true;
    settings.search.mode = "fuzzy";
  };

  plugins.harpoon = {
    enable = true;
    enableTelescope = true;
  };

  plugins.telescope = {
    enable = true;
    extensions = {
      fzf-native.enable = true;
      undo.enable = true;
    };
    keymaps = {
      "<leader>fg" = "live_grep";
    };
  };

  keymaps = [
    # Harpoon
    (mkKeymap "n" "<Leader>ha" '':lua require("harpoon.mark").toggle_file()<CR>''     "Toggle harpoon")
    (mkKeymap "n" "<Leader>hc" '':lua if vim.fn.confirm("Clear all Harpoon marks?", "&Yes\n&No", 2) == 1 then require("harpoon.mark").clear_all() end<CR>'' "Remove all harpoon marks")
    (mkKeymap "n" "<Leader>hh" '':lua require("harpoon.ui").toggle_quick_menu()<CR>'' "Open harpoon menu")
    (mkKeymap "n" "<Leader>1"  '':lua require("harpoon.ui").nav_file(1)<CR>''         "Toggle harpoon file 1")
    (mkKeymap "n" "<Leader>2"  '':lua require("harpoon.ui").nav_file(2)<CR>''         "Toggle harpoon file 2")
    (mkKeymap "n" "<Leader>3"  '':lua require("harpoon.ui").nav_file(3)<CR>''         "Toggle harpoon file 3")
    (mkKeymap "n" "<Leader>4"  '':lua require("harpoon.ui").nav_file(4)<CR>''         "Toggle harpoon file 4")

    (mkKeymap "n" "<Tab>" ":BufferLineCycleNext<CR>" "Cycle to next tab")
    (mkKeymap "n" "<S-Tab>" ":BufferLineCyclePrev<CR>" "Cycle to previous tab")
    (mkKeymap "n" "<C-w>" ":bd<CR>" "Close current tab")
  ];

}
