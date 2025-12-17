{ ... }: {

  plugins = {
    nvim-tree = {
      enable = true;
      openOnSetup = true;
      settings = {
        view.float.enable = true;
        auto_reload_on_write = true;
        hijack_netrw = true;
        disable_netrw = true;
      };
    };
  };

} 
