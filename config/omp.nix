{ ... }:
{
  programs.omp = {
    enable = true;
    # See https://github.com/can1357/oh-my-pi/blob/main/docs/settings.md
    settings = {
      symbolPreset = "nerd";
      theme.dark = "dark-catppuccin";
      skills.enableSkillCommands = true;
      startup.quiet = true;
      lsp = {
        diagnosticsOnWrite = true;
        diagnosticsOnEdit = true;
        diagnosticsDeduplicate = true;
      };
      eval.py = false; # Disable python eval
      astGrep.enabled = true;
      github.enabled = true;
      browser.headless = false; # observe browsing agents
      telemetry.otlpExportEnabled = false;

      # Latest onboarding options
      modelRoles = {
        default = "google-vertex/gemini-3.1-pro-preview";
      };
      statusLine.preset = "nerd";
      composer.shape = "band";

      # Ensure OMP doesn't open onboarding every time nix is reloaded, unless new
      # onboarding step is introduced. On completing new onboarding, bump this number to latest.
      # See https://github.com/can1357/oh-my-pi/blob/53f253fb709fe890adf1fa37f0bc69cf02a5d86c/packages/tui/src/setup/setup-version.ts
      setupVersion = 2;
    };
  };
}
