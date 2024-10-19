{...}: {
  plugins.treesitter = {
    enable = true;
    settings = {
      highlight = {
        additional_vim_regex_highlighting = false;
        enable = true;
      };
    };
  };
}
