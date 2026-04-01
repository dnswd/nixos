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

  # Sherpa-onnx for pi-listen local models
  sherpa-onnx = pkgs.callPackage ../sherpa-onnx { };
  
  # Node.js bindings for sherpa-onnx (optional dependency for pi-listen)
  sherpa-onnx-node = pkgs.callPackage ../sherpa-onnx-node { };

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
    home.packages = [ piMono ] ++ lib.optionals cfg.voiceInput.enable [
      pkgs.sox        # Audio recording for pi-listen
      sherpa-onnx     # Local speech recognition for pi-listen
    ];

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
      // optionalAttrs (cfg.extensions != null) {
      ".pi/agent/extensions".source = pkgs.runCommand "pi-extensions-with-deps"
        { buildInputs = [ pkgs.nodejs ]; }
        ''
          mkdir -p $out
          cp -r ${cfg.extensions}/* $out/
          
          # Install npm deps for pi-listen if present
          if [ -d "$out/pi-listen" ]; then
            cd $out/pi-listen
            # Install production deps (omit optional)
            npm ci --omit=optional 2>/dev/null || npm install --omit=optional 2>/dev/null || true
            
            # Link sherpa-onnx-node for local voice support
            mkdir -p node_modules
            ln -sf ${sherpa-onnx-node}/lib/sherpa-onnx-node node_modules/sherpa-onnx-node
          fi
        '';
    }
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
