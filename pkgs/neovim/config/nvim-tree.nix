{ ... }: {

  plugins = {
    nvim-tree = {
      enable = true;
      autoReloadOnWrite = true;
      disableNetrw = true;
      hijackNetrw = true;
      openOnSetup = true;
      view.float.enable = true;
    };
  };

} 
