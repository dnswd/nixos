{
  config,
  pkgs,
  lib,
  ...
}:
let
  personal = import ./identity.nix;
in
{
  programs.rbw = {
    enable = true;
    settings = {
      email = personal.email.bitwarden;
      lock_timeout = 3600; # 1 hour in seconds
      pinentry =
        if config.wayland.windowManager.hyprland.enable then pkgs.pinentry-gtk2 else pkgs.pinentry-gnome3;
    };
  };
}
