{ pkgs, ... }:
{
  imports = [
    ../../../pkgs/pi-mono
  ];

  programs.pi-mono = {
    enable = true;
    settings = {
      defaultProvider = "ollama";
      defaultModel = "qwen3-coder:latest";
    };
    models = {
      providers.ollama = {
        baseUrl = "http://100.122.233.72:11434/v1";
        api = "openai-completions";
        apiKey = "ollama";
        models = [
          { id = "qwen3-coder:latest"; }
        ];
      };
    };
    voiceInput = {
      device = "alsa_input.usb-DCMT_Technology_USB_Condenser_Microphone_214b206000000178-00.mono-fallback";
      language = "en";
    };
    agentsMd.source = ./AGENTS.md;
    extensions.monorepoPath = ./extensions;
    skills = ./skills;
    prompts = ./prompts;
  };
}
