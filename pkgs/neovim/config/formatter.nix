{...}: {

  plugins.conform-nvim = {
    enable = true;
    formatOnSave = {
      lspFallback = true;
      formattersByFt = {
        yaml = ["prettierd" "prettier"];
      };
    };
  };

}


