{ pkgs, ... }: {
  # Enable hyprland
  wayland.windowManager.hyprland = {
    enable = true;
    package = pkgs.hyprland.hyprland;
    xwayland.enable = true;
    # withSystemd = true;
    settings = {
      "$mod" = "SUPER";
      bind =
        [
          "$mod, F, exec, firefox"
          ", Print, exec, grimblast copy area"
        ] ++ (
          # workspaces
          # binds $mod + [shift +] {1..9} to [move to] workspace {1..9}
          builtins.concatLists (builtins.genList
            (i:
              let ws = i + 1;
              in [
                "$mod, code:1${toString i}, workspace, ${toString ws}"
                "$mod SHIFT, code:1${toString i}, movetoworkspace, ${toString ws}"
              ]
            )
            9)
        );
    };
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

  # Enable QT
  qt.enable = true;
}

