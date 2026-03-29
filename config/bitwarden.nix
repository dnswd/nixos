{
  config,
  pkgs,
  lib,
  ...
}:
{
  imports = [ ./agenix.nix ];

  age.secrets.rbw-config = {
    file = ../secrets/rbw-config.json.age;
    path = "${config.xdg.configHome}/rbw/config.json";
  };

  # rbw config is decrypted directly to ~/.config/rbw/config.json by agenix
  # Only set non-secret options here
  programs.rbw = {
    enable = true;
    settings = {
      lock_timeout = 3600;
      pinentry =
        if config.wayland.windowManager.hyprland.enable then pkgs.pinentry-gtk2 else pkgs.pinentry-gnome3;
    };
  };
}
