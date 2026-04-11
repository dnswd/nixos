{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

with lib;
let
  cfg = config.programs.pi-mono;
  jsonFormat = pkgs.formats.json { };

  # pi-listen voice input extension (includes sherpa-onnx-node with native bindings)
  pi-listen = pkgs.callPackage ../pi-listen { };

  # pi-web-browse web search extension (includes playwright, undici, etc.)
  pi-web-browse = pkgs.callPackage ../pi-web-browse { };

  # plannotator extension for plan review (pure TypeScript, no build)
  plannotator = pkgs.callPackage ../plannotator-pi-extension { };

  # pi-lsp extension for language server protocol support
  pi-lsp = pkgs.callPackage ../pi-lsp { };

  # pi-browser extension (built from standalone pnpm lockfile)
  pi-browser = pkgs.callPackage ../pi-browser { };

  pi-mono-src = inputs.pi-mono;

  packageJson = builtins.fromJSON (
    builtins.readFile (inputs.pi-mono + "/packages/coding-agent/package.json")
  );

  piMonoPkg = import ./coding-agent.nix;
  piMono = piMonoPkg { inherit pkgs pi-mono-src; };

  promptFiles = lib.optionalAttrs (cfg.prompts != null) (builtins.readDir cfg.prompts);
  prompts = filterAttrs (n: v: v == "regular" && hasSuffix ".md" n) promptFiles;

  defaultSettings = {
    lastChangelogVersion = packageJson.version;
    defaultProvider = "anthropic";
    defaultModel = "claude-opus-4-5";
    defaultThinkingLevel = "medium";
  };

  defaultKeybindings = {
    cursorUp = [
      "up"
    ];
    cursorDown = [
      "down"
    ];
    cursorLeft = [
      "left"
    ];
    cursorRight = [
      "right"
    ];
    toggleThinking = [
      "ctrl+t"
    ];
  };

in
{
  options.programs.pi-mono = {
    enable = mkEnableOption "pi-mono coding agent";

    voiceInput = {
      enable = mkEnableOption ''voice input functionality (pi-listen extension).
        After enabling, run `pi install npm:@codexstar/pi-listen` inside pi TUI.
        Uses sherpa-onnx for local models (offline) - run `/voice-settings` to configure.
      '';

      device = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Audio input device for voice recording. Auto-detected if null.";
        example = "alsa_input.platform-sound.HiFi__Headset__source";
      };
    };

    settings = mkOption {
      inherit (jsonFormat) type;
      default = defaultSettings;
      example = defaultSettings;
      description = "JSON configuration for pi-mono global settings.json (https://github.com/badlogic/pi-mono/blob/030a61d/packages/coding-agent/docs/settings.md)";
    };

    keybindings = mkOption {
      inherit (jsonFormat) type;
      default = defaultKeybindings;
      example = defaultKeybindings;
      description = "JSON configuration for pi-mono global keybindings.json (https://github.com/badlogic/pi-mono/blob/030a61d88c665e688f75f5149a8a50ea971d3470/packages/coding-agent/docs/keybindings.md)";
    };

    agentsMd = {
      text = mkOption {
        type = types.nullOr types.lines;
        default = null;
        description = ''
          Inline AGENTS.md content.
          This option is mutually exclusive with agentsMd.source.
        '';
        example = ''
          # Project Memory

          ## Current Task
          Implementing enhanced claude-code module for home-manager.

          ## Key Files
          - claude-code.nix: Main module implementation
        '';
      };

      source = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = ''
          Path to a file containing content for AGENTS.md.
          This option is mutually exclusive with agentsMd.text.
        '';
        example = literalExpression "./AGENTS.md";
      };
    };

    extensions = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Path to the extensions directory.
        Will be symlinked to ~/.pi/agent/extensions.
        Pi-mono loads TypeScript directly via jiti, no build step needed.
      '';
    };

    skills = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Path to the skill workspace.
        Will be built and symlinked to ~/.pi/agent/skills
      '';
    };

    prompts = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Path to the prompts directory containing .md files.
        Will be symlinked to ~/.pi/agent/prompts
      '';
    };

    models = mkOption {
      inherit (jsonFormat) type;
      default = null;
      example = literalExpression ''
        {
          providers.ollama = {
            baseUrl = "http://localhost:11434/v1";
            api = "openai-completions";
            apiKey = "ollama";
            models = [
              { id = "qwen2.5-coder:32b"; }
              { id = "llama3.1:70b"; }
            ];
          };
        }
      '';
      description = "JSON configuration for custom providers/models in ~/.pi/agent/models.json (https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/models.md)";
    };
  };

  config = mkIf cfg.enable {
    home.packages = [ piMono pkgs.poppler-utils ];

    home.sessionVariables = mkIf (cfg.voiceInput.enable && cfg.voiceInput.device != null) {
      PULSE_INPUT_DEVICE = cfg.voiceInput.device;
    };

    home.activation.pi-mono-config = lib.hm.dag.entryAfter [ "writeBoundary" ] (
      let
        settingsFile = jsonFormat.generate "settings.json" cfg.settings;
        keybindingsFile = jsonFormat.generate "keybindings.json" cfg.keybindings;
        modelsFile = if cfg.models != null then jsonFormat.generate "models.json" cfg.models else null;
      in ''
        $DRY_RUN_CMD mkdir -p "$HOME/.pi/agent"
        
        # Copy config files (writable, pi-mono needs to modify them)
        $DRY_RUN_CMD cp -f "${settingsFile}" "$HOME/.pi/agent/settings.json"
        $DRY_RUN_CMD chmod 644 "$HOME/.pi/agent/settings.json"
        $DRY_RUN_CMD cp -f "${keybindingsFile}" "$HOME/.pi/agent/keybindings.json"
        $DRY_RUN_CMD chmod 644 "$HOME/.pi/agent/keybindings.json"
        
        ${optionalString (modelsFile != null) ''
          $DRY_RUN_CMD cp -f "${modelsFile}" "$HOME/.pi/agent/models.json"
          $DRY_RUN_CMD chmod 644 "$HOME/.pi/agent/models.json"
        ''}


      ''
    );

    home.file = {}
    // optionalAttrs (cfg.agentsMd.text != null) {
      ".pi/agent/AGENTS.md".source = pkgs.writeText "AGENTS.md" cfg.agentsMd.text;
    }
    // optionalAttrs (cfg.agentsMd.source != null) {
      ".pi/agent/AGENTS.md".source = cfg.agentsMd.source;
    }
    // {
      # Type B extensions (native deps) - built by Nix
      ".pi/agent/extensions/pi-browser".source = "${pi-browser}/lib/pi-browser";
      ".pi/agent/extensions/pi-lsp".source = "${pi-lsp}/lib/pi-lsp";
      ".pi/agent/extensions/pi-web-browse".source = "${pi-web-browse}/lib/pi-web-browse";
      ".pi/agent/extensions/plannotator-pi-extension".source = "${plannotator}/lib/plannotator-pi-extension";
    }
    // optionalAttrs (cfg.voiceInput.enable) {
      ".pi/agent/extensions/pi-listen".source = "${pi-listen}/lib/pi-listen";
    }
    // optionalAttrs (cfg.extensions != null) (
      # Type A extensions (pure TS) - symlinked from local directory
      mapAttrs' (
        name: _:
        nameValuePair ".pi/agent/extensions/${name}" {
          source = cfg.extensions + "/${name}";
          force = true;
        }
      ) (filterAttrs (n: v: v == "directory" && n != "node_modules") (builtins.readDir cfg.extensions))
    )
    // optionalAttrs (cfg.skills != null) {
      ".pi/agent/skills".source = cfg.skills;
    }
    // optionalAttrs (cfg.prompts != null) (
      mapAttrs' (
        name: _:
        nameValuePair ".pi/agent/prompts/${name}" {
          source = cfg.prompts + "/${name}";
        }
      ) prompts
    );
  };
}
