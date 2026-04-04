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
  # The programs.rbw.settings option is required by home-manager but the actual
  # config file is entirely replaced by agenix at activation time.
  # PLACEHOLDER VALUES - real values come from secrets/rbw-config.json.age
  programs.rbw = {
    enable = true;
    settings = {
      email = "@BITWARDEN-EMAIL@"; # will be overwritten by agenix secret
      lock_timeout = 3600;
      pinentry =
        if config.wayland.windowManager.hyprland.enable then pkgs.pinentry-gtk2 else pkgs.pinentry-gnome3;
    };
  };
}
