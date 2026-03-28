{ pkgs, ... }:
let
  personal = import ../../identity.nix;
in
{
  imports = [
    ../../../pkgs/pi-mono
  ];

  programs.pi-mono = {
    enable = true;
    settings = {
      defaultProvider = "llamacpp";
      defaultModel = "Qwen3.5-35B-A3B-GGUF";
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
      providers.anthropic = {
        apiKey = personal.apiKeys.anthropic;
        models = [
          { id = "claude-opus-4-6"; }
          { id = "claude-sonnet-4-6"; }
          { id = "claude-haiku-4-5"; }
        ];
      };
    };
    agentsMd.source = ./AGENTS.md;
    extensions = ./extensions;
    skills = ./skills;
    prompts = ./prompts;
  };
}
