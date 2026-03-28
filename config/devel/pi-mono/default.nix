{ pkgs, ... }:
{
  imports = [
    ../../../pkgs/pi-mono
  ];

  programs.pi-mono = {
    enable = true;
    settings = {
      defaultProvider = "llamacpp";
      defaultModel = "qwen3-coder:latest";
    };
    models = {
      providers.llamacpp = {
        baseUrl = "http://100.122.233.72:11434/v1";
        api = "openai-completions";
        apiKey = "none";
        models = [
          { 
            id = "Qwen3.5-35B-A3B-GGUF";
          }
        ];
      };
    };
    agentsMd.source = ./AGENTS.md;
    extensions = ./extensions;
    skills = ./skills;
    prompts = ./prompts;
  };
}
