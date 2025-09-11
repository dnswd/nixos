{ pkgs, ... }: {
  # Enable hyprland
  wayland.windowManager.hyprland = {
    enable = true;
    package = null;
    portalPackage = null;
    xwayland.enable = true;
    systemd = {
      enable = true;
      enableXdgAutostart = true;
    };
    plugins = with pkgs.hyprlandPlugins; [
      xtra-dispatchers # close all hidden windows
      # hyprsplit # awesome-like split workspace controls for multiple monitor
      hyprspace # gnome / macos like workspace overview with app drag n drop
      # hypr-dynamic-cursors # shake to find cursor (need to disable defaults)
      # hy3 # i3 like tiling management (need to learn hyprland native limitations)
      csgo-vulkan-fix # force app with fake resolution

    ];
    settings = {
      "$mod" = "SUPER";
      bind =
        [
          # Swith two most recent workspace $mod TAB
          # Pad active workspace with empty workspace
          # App Lauchers
          "$mod, Return, exec, kitty" # Super+Enter for terminal
          "$mod, D, exec, wofi --show drun" # Super+d for app launcher
          "$mod, F, exec, firefox" # Super+f for firefox

          # Window management
          "$mod, Q, killactive"
          "$mod, M, fullscreen"
          "$mod, V, togglefloating"
          "$mod, P, pseudo"
          "$mod, J, togglesplit"

          # Move focus
          "$mod, left, movefocus, l"
          "$mod, right, movefocus, r"
          "$mod, up, movefocus, u"
          "$mod, down, movefocus, d"

          # Session management
          "$mod SHIFT, Q, exit" # logout

          # Screenshot
          ", Print, exec, flameshot gui"
        ] ++ (
          # Workspaces
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
      debug = {
        disable_logs = true;
      };
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

  # Install programs/packages for configs
  # TODO move to dedicated nix files/folders
  home.packages = with pkgs; [
    grim
    slurp
    wl-clipboard
    flameshot
  ];
  programs.wofi.enable = true;
}

