{ ... }:
{
  plugins.oil = {
    enable = true;
    settings = {
      columns = [
        "icon"
        "permissions"
      ];
      default_file_explorer = true;
      settings.view_options = {
        show_hidden = true;
        show_icons = true;
      };
    };
  };

  plugins.oil-git-status = {
    enable = true;
  };

  keymaps = [
    {
      mode = "n";
      key = "-";
      options.desc = "Open Oil file explorer";
      action = "<cmd>Oil<CR>";
    }
  ];
}
