{ ... }: {
  plugins.treesitter = {
    enable = true;
    settings = {
      highlight = {
        additional_vim_regex_highlighting = false;
        enable = true;
      };
    };
    luaConfig.post = builtins.readFile ./config.lua;
  };

  plugins.treesitter-textobjects = {
    enable = true;
    lspInterop = {
      enable = true;
    };
  };
}
