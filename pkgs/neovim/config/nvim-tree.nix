{ ... }: {
  plugins = {
    # use nvim-tree
    nvim-tree = {
      enable = true;
      autoReloadOnWrite = true;
      disableNetrw = true;
      hijackNetrw = true;
      openOnSetup = true;
    };
  };

} 
