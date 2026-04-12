{
  config,
  pkgs,
  lib,
  ...
}:
{
  imports = [ ./secrets.nix ];

  programs.rbw = {
    enable = true;
    # Config managed by activation script in secrets.nix (writes ~/.config/rbw/config.json)
    settings = null;
  };
}
