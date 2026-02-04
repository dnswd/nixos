{ pkgs, ... }:
{
  imports = [
    ../../../pkgs/pi-mono
  ];

  services.ollama = {
    enable = true;
    package = pkgs.ollama-rocm;
    acceleration = "rocm";
    port = 11434;
  };

  programs.pi-mono = {
    enable = true;
    settings = {
      defaultProvider = "ollama";
      defaultModel = "qwen3-coder:latest";
    };
    models = {
      providers.ollama = {
        baseUrl = "http://localhost:11434/v1";
        api = "openai-completions";
        apiKey = "ollama";
        models = [
          { id = "qwen3-coder:latest"; }
        ];
      };
    };
  };
}
