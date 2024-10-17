{
  ...
}: let

in {

  plugins.treesitter = {
    enable = true;
    folding = false;
    nixGrammars = true;
    nixvimInjections = true;
    settings = {
      indent.enable = true;
      highlight.enable = true;
      incremental_selection.enable = true;
    };
  };

  plugins.treesitter-context.enable = true;
  plugins.treesitter-refactor.enable = true;
  plugins.treesitter-textobjects.enable = true;

}
