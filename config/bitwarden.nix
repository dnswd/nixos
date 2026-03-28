{
  config,
  pkgs,
  lib,
  ...
}:
let
  identityPath = "/run/agenix/identity";
  rbwConfigDir = "${config.xdg.configHome}/rbw";
in
{
  home.activation.rbw-identity = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    if [ -f "${identityPath}" ]; then
      EMAIL=$(${pkgs.jq}/bin/jq -r '.email.bitwarden' "${identityPath}")
      
      $DRY_RUN_CMD mkdir -p "${rbwConfigDir}"
      
      # Read existing config or create new one
      if [ -f "${rbwConfigDir}/config.json" ]; then
        EXISTING=$(cat "${rbwConfigDir}/config.json")
      else
        EXISTING='{}'
      fi
      
      # Update email in config
      echo "$EXISTING" | ${pkgs.jq}/bin/jq --arg email "$EMAIL" '.email = $email' > "${rbwConfigDir}/config.json.tmp"
      $DRY_RUN_CMD mv "${rbwConfigDir}/config.json.tmp" "${rbwConfigDir}/config.json"
    fi
  '';

  programs.rbw = {
    enable = true;
    settings = {
      lock_timeout = 3600;
      pinentry =
        if config.wayland.windowManager.hyprland.enable then pkgs.pinentry-gtk2 else pkgs.pinentry-gnome3;
    };
  };
}
