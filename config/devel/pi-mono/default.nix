{ pkgs, lib, config, osType ? "linux", ... }:
{
  imports = [
    ../../../pkgs/pi-mono
    ../../agenix.nix
  ];

  age.secrets.pi-fireworks-key = {
    file = ../../../secrets/fireworks-api-key.age;
  };

  age.secrets.pi-auth = {
    file = ../../../secrets/pi-auth.json.age;
    path = "${config.home.homeDirectory}/.pi/agent/auth.json";
  };

  # pi-mono auth.json is decrypted directly by agenix
  programs.pi-mono = {
    enable = true;

    settings = {
      defaultProvider = "fireworks";
      defaultModel = "accounts/fireworks/models/kimi-k2p5";
    };
    agentsMd.source = ./AGENTS.md;
    extensions = ./extensions;
    skills = ./skills;
    prompts = ./prompts;

    models = {
      providers = {
        fireworks = {
          baseUrl = "https://api.fireworks.ai/inference/v1";
          api = "openai-completions";
          apiKey = "!cat ${config.age.secrets.pi-fireworks-key.path}";
          models = [
            {
              id = "accounts/fireworks/models/kimi-k2p5";
              name = "Kimi K2.5 (Fireworks)";
              reasoning = true;
              input = [ "text" ];
              contextWindow = 262144;
              maxTokens = 16384;
              cost = { input = 0; output = 0; cacheRead = 0; cacheWrite = 0; };
            }
          ];
        };

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
