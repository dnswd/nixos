{ ... }: {
  catppuccin.kitty.enable = true;
  programs.kitty = {
    enable = true;
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

      # Reset all default shortcuts (terminal operation moved to tmux)
      clear_all_shortcuts = true;
    };

    # Essentials
    keybindings = {
      # paste
      "ctrl+shift+v" = "paste_from_clipboard";
      # font
      "ctrl+shift+equal" = "change_font_size all +2.0";
      "ctrl+shift+plus" = "change_font_size all +2.0";
      "ctrl+shift+minus" = "change_font_size all -2.0";
      "ctrl+shift+backspace" = "change_font_size all 0";
      # url
      "ctrl+shift+e" = "open_url_with_hints";
      # fullscreen (zen)
      "ctrl+shift+f" = "toggle_fullscreen";

    };
  };
}
