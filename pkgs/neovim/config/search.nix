{
  ...
}: {

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

}
