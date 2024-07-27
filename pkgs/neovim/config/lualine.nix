{
  ...
}: {

  plugins.lualine = {
    enable = true;
    globalstatus = true;
    theme = "palenight";
    sections = { 
      lualine_c = [ "lsp_progress" ];
      lualine_x = [ # Show is macro recording 
        {
          name.__raw = /* lua */ "require('noice').api.statusline.mode.get";
          extraConfig.cond.__raw = /* lua */ "require('noice').api.statusline.mode.has";
        }
      ];
    };
  };

}
