{
  ...
}: {

  plugins.lualine = {
    enable = true;
    globalstatus = true;
    theme = "palenight";
    sections = { 
      lualine_c = [ "lsp_progress" ];
    };
  };

}
