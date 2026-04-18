{
  config,
  pkgs,
  lib,
  secrets,
  ...
}:
{
  programs.rbw = {
    enable = true;
    settings.email = secrets.email_secondary;
  };
}
