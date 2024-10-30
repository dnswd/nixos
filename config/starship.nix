{ ... }: {
  programs.starship = {
    enable = true;
    catppuccin.enable = true;

    # All supported shells are enabled by default
    # Disable unused shells
    enableFishIntegration = false;
    enableIonIntegration = false;
    enableNushellIntegration = false;

    settings = {
      character = {
        success_symbol = "[λ](bold green)";
        error_symbol = "[λ](bold red)";
      };

      cmd_duration = {
        min_time = 500;
      };
    };
  };
}
