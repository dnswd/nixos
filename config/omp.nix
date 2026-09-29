{ ... }:
{
  programs.omp = {
    enable = true;
    settings = {
      symbolPreset = "unicode";
      theme.dark = "dark-catppuccin";
      skills.enableSkillCommands = true;
      startup.quiet = true;
      composer.shape = "band";
    };
  };
}
