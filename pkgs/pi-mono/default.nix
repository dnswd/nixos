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
    defaultThinkingLevel = "off";
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

  buildExtensions = import ./nix/extensions.nix;
  builtExtensions = lib.optionalAttrs (cfg.extensions.monorepoPath != null) (buildExtensions {
    inherit pkgs;
    extensions-src = cfg.extensions.monorepoPath;
    pi-mono-src = pi-mono-src;
  });

in
{
  options.programs.pi-mono = {
    enable = mkEnableOption "pi-mono coding agent";

    voiceInput = {
      device = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "PulseAudio/PipeWire input device for voice recording. Auto-detected if null.";
        example = "alsa_input.platform-sound.HiFi__Headset__source";
      };

      language = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "ISO-639-1/3 language code for speech recognition.";
        example = "en";
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

    extensions = {
      monorepoPath = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = ''
          Path to the extensions workspace (monorepo containing multiple extensions).
          Will be built and symlinked to ~/.pi/agent/extensions
        '';
      };

      nodePackage = mkPackageOption pkgs "nodejs_24" { nullable = true; };
      pnpmPackage = mkPackageOption pkgs "pnpm_10" { nullable = true; };
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
    home.packages = [ piMono ];

    home.sessionVariables = mkMerge [
      (mkIf (cfg.voiceInput.device != null) {
        PULSE_INPUT_DEVICE = cfg.voiceInput.device;
      })
      (mkIf (cfg.voiceInput.language != null) {
        ELEVENLABS_LANGUAGE = cfg.voiceInput.language;
      })
    ];

    home.file = {
      ".pi/agent/settings.json".source = jsonFormat.generate "settings.json" cfg.settings;
      ".pi/agent/keybindings.json".source = jsonFormat.generate "keybindings.json" cfg.keybindings;
    }
    // optionalAttrs (cfg.agentsMd.text != null) {
      ".pi/agent/AGENTS.md".source = pkgs.writeText "AGENTS.md" cfg.agentsMd.text;
    }
    // optionalAttrs (cfg.agentsMd.source != null) {
      ".pi/agent/AGENTS.md".source = cfg.agentsMd.source;
    }
    // optionalAttrs (cfg.extensions.monorepoPath != null) {
      ".pi/agent/extensions".source = builtExtensions;
    }
    // optionalAttrs (cfg.skills != null) {
      ".pi/agent/skills".source = cfg.skills;
    }
    // optionalAttrs (cfg.models != null) {
      ".pi/agent/models.json".source = jsonFormat.generate "models.json" cfg.models;
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
