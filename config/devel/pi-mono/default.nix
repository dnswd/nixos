{ pkgs, lib, config, osType ? "linux", ... }:
{
  imports = [
    ../../../pkgs/pi-mono
    ../../../secrets/agenix-home.nix
  ];

  # pi-mono auth.json is decrypted directly by agenix
  programs.pi-mono = {
    enable = true;

    settings = {
      defaultProvider = "llamacpp";
      defaultModel = "Qwen3.5-35B-A3B-GGUF";
    };
    agentsMd.source = ./AGENTS.md;
    extensions = ./extensions;
    skills = ./skills;
    prompts = ./prompts;

    models = {
      providers = {
        llamacpp = {
          baseUrl = "http://100.122.233.72:11434/v1";
          api = "openai-completions";
          apiKey = "none";
          models = [
            { id = "Qwen3.5-35B-A3B-GGUF"; }
          ];
        };
      };
    };
  };
}
