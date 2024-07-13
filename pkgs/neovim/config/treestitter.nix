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

  plugins.treesitter = {
    enable = true;
    # folding = true;
    nixGrammars = true;
    nixvimInjections = true;
    # settings = {
    #   indent.enable = true;
    #   highlight.enable = true;
    # };
  };

  plugins.treesitter-context.enable = true;
  plugins.treesitter-refactor.enable = true;
  plugins.treesitter-textobjects.enable = true;

  extraPlugins = with pkgs.vimPlugins; [
    vim-tmux-clipboard
  ];

}
