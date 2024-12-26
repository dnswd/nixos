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

}
