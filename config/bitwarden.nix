{
  config,
  pkgs,
  lib,
  ...
}:
{
  imports = [ ../secrets/agenix-home.nix ];

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
