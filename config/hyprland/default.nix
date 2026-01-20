{ pkgs, ... }: {
  
  # Import packages needed for hyprland to work
  imports = [
    ./autostart.nix
    ./bindings.nix
    ./env.nix
    ./hypridle.nix
    ./hyprlock.nix
    ./hyprpaper.nix
    ./hyprpolkit.nix
    ./input.nix
    ./visual.nix
    ./windows.nix
    ./wlogout.nix
  ];

  # Packages not yet configurable with nix files but supports hyprland
  # home.packages = with pkgs; [
  #   grim
  #   slurp
  #   wl-clipboard
  #   flameshot
  # ];

  # Optional, hint Electron apps to use Wayland:
  home.sessionVariables.NIXOS_OZONE_WL = "1";

  # Enable QT
  # TODO: Check https://github.com/SX-9/nix-conf/blob/6df2934c2ce646b86e308f1334e264af38a70122/rice/home.nix#L179
  qt = {
    enable = true;
    platformTheme.name = "kvantum";
    style = {
      name = "kvantum";
    };
  };
  
  # GUI popup that shows the password prompt for priveledge escalation
  services.hyprpolkitagent.enable = true;

  wayland.windowManager.hyprland = {
    enable = true;
    package = null; # use nixos definition, see ikigai/configurations.nix
    portalPackage = null; # use nixos definition
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
      "$terminal" = "kitty";
      "$fileManager" = "nautilus --new-window";
      "$browser" = "chromium --new-window --ozone-platform=wayland";
      "$music" = "spotify";
      "$passwordManager" = "1password";
      "$messenger" = "slack";
      "$webapp" = "$browser --app";

      debug.disable_logs = true;
    };
  };
}

