{ ... }: {

  programs.wlogout = {
    enable = true;
    layout = [
      {
        label = "lock";
        # lock/switch user session with gdm
        action = "gdbus call --system --dest org.gnome.DisplayManager --object-path /org/gnome/DisplayManager/LocalDisplayFactory --method org.gnome.DisplayManager.LocalDisplayFactory.CreateTransientDisplay";
        text = "lock";
        keybind = "l";
      }

      {
        label = "logout";
        action = "hyprctl dispatch exit";
        text = "logout";
        keybind = "e";
      }

      {
        label = "suspend";
        action = "systemctl suspend";
        text = "suspend";
        keybind = "u";
      }

      {
        label = "hibernate";
        action = "systemctl hibernate";
        text = "hibernate";
        keybind = "h";
      }

      {
        label = "shutdown";
        action = "systemctl poweroff";
        text = "shutdown";
        keybind = "s";
      }

      {
        label = "restart";
        action = "systemctl reboot";
        text = "restart";
        keybind = "r";
      }
    ];
  };
}
