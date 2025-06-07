{ pkgs, ... }: {
  # Enable hyprland
  wayland.windowManager.hyprland = {
    enable = true;
    package = pkgs.hyprland.hyprland;
    xwayland.enable = true;
    # withSystemd = true;
  };

  # Optional, hint Electron apps to use Wayland:
  home.sessionVariables.NIXOS_OZONE_WL = "1";

  # Critical softwares
  services = {
    dunst.enable = true;
    # pipewire and wireplumber
    # xdg portal xdg.portal = { enable = true; extraPortals = [ pkgs.xdg-desktop-portal-gtk ]; };
    hyprpolkitagent.enable = true;
    # Enable qt 5/6
  };
  qt.enable = true;
}

