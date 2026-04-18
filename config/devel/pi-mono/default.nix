{ pkgs, lib, config, osType ? "linux", secrets, ... }:
{
  imports = [
    ../../../pkgs/pi-mono
  ];

  # LSP server configuration for pi-lsp extension
  home.file.".pi/agent/extensions/lsp/config.json" = {
    force = true;
    text = builtins.toJSON {
      lsp = {
        typescript = {
          command = [ "typescript-language-server" "--stdio" ];
          extensions = [ ".ts" ".tsx" ".js" ".jsx" ".mjs" ".cjs" ".mts" ".cts" ];
        };
        nix = {
          command = [ "nixd" ];
          extensions = [ ".nix" ];
        };
        rust = {
          command = [ "rust-analyzer" ];
          extensions = [ ".rs" ];
        };
        go = {
          command = [ "gopls" ];
          extensions = [ ".go" ];
        };
        python = {
          command = [ "pyright-langserver" "--stdio" ];
          extensions = [ ".py" ];
        };
        bash = {
          command = [ "bash-language-server" "start" ];
          extensions = [ ".sh" ".bash" ];
        };
        c = {
          command = [ "clangd" ];
          extensions = [ ".c" ".h" ".cpp" ".hpp" ];
        };
        toml = {
          command = [ "taplo" "lsp" "stdio" ];
          extensions = [ ".toml" ];
        };
        yaml = {
          command = [ "yaml-language-server" "--stdio" ];
          extensions = [ ".yaml" ".yml" ];
        };
        java = {
          command = [ "jdt-language-server" ];
          extension = [ ".java" ];
        };
        json = {
          command = [ "vscode-json-languageserver" "--stdio" ];
          extensions = [ ".json" ];
        };
      };
    };
  };

  # pi-mono configuration
  programs.pi-mono = {
    enable = true;
    voiceInput.enable = true;

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
        openrouter = {
          baseUrl = "https://openrouter.ai/api/v1";
          api = "openai-completions";
          apiKey = secrets.openrouter;
          models = [
            {
              id = "moonshotai/kimi-k2.5:";
              name = "Kimi K2.5 (OR)";
              reasoning = true;
              input = [ "text" "image" ];
              contextWindow = 256000;
              maxTokens = 8192;
              cost = { input = 2; output = 8; cacheRead = 0; cacheWrite = 0; };
            }
          ];
        };

        fireworks = {
          baseUrl = "https://api.fireworks.ai/inference/v1";
          api = "openai-completions";
          apiKey = secrets.fireworks_ai;
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
      };
    };
  };
}
