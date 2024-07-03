{
  pkgs,
  lib,
  ...
}: {
  programs.kitty = {
    enable = true;
    catppuccin.enable = true;
    font.name = "FantasqueSansM Nerd Font";
    font.size = 12;
    settings = {
      confirm_os_window_close = 0;
      enable_audio_bell = false;
      allow_remote_control = true;
      copy_on_select = true;
      window_padding_width = "1 5"; # vertical horizontal
      background_opacity = "0.8";
      cursor_text_color = "background";
      disable_ligatures = "cursor";

      # Font
      font_family = "FantasqueSansM Nerd Font";
      bold_font = "auto";
      italic_font = "auto";
      bold_italic_font = "auto";
    };
    keybindings = {
      "cmd+w" = "no_op";
      "cmd+t" = "no_op";
      "cmd+enter" = "no_op";
    };
  };
}
