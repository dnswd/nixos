{
  config,
  pkgs,
  ...
}: {
  programs.ghostty = {
    enable = true;
    settings = {
      window-padding-x = 14;
      window-padding-y = 14;
      background-opacity = 0.95;
      window-decoration = "none";

      font-family = "FantasqueSansMono";
      font-size = 12;

      keybind = [
        "ctrl+k=reset"
      ];
    };
  };
}
