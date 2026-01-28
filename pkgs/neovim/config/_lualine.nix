{ ... }: {
  plugins.lualine = {
    enable = true;
    settings = {
      options = {
        globalstatus = true;
        theme = "palenight";
      };
      sections = {
        lualine_c = [ "lsp_progress" ];
      };
    };
  };
}
