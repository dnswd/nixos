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

  # Experimental neovim UI
  plugins.noice = {
    enable = true;
    presets = {
      bottom_search = true;   # use a classic bottom cmdline for search
      command_palette = true; # position the cmdline and popupmenu together
      long_message_to_split = true; # long messages will be sent to a split
      inc_rename = false;     # enables an input dialog for inc-rename.nvim
      lsp_doc_border = false; # add a border to hover docs and signature help
    };
  };

  extraPlugins = with pkgs.vimPlugins; [
    vim-tmux-clipboard
  ];

}
