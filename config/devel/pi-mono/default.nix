{ pkgs, lib, config, osType ? "linux", ... }:
let
  identityPath = "/run/agenix/identity";
in
{
  imports = [
    ../../../pkgs/pi-mono
  ];

  home.activation.pi-mono-models = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    if [ -f "${identityPath}" ]; then
      $DRY_RUN_CMD mkdir -p "$HOME/.pi/agent"
      
      ANTHROPIC_KEY=$(${pkgs.jq}/bin/jq -r '.apiKeys.anthropic // empty' "${identityPath}")
      
      # Generate models.json with the API key
      cat > "$HOME/.pi/agent/models.json" << 'MODELS_EOF'
{
  "providers": {
    "llamacpp": {
      "baseUrl": "http://100.122.233.72:11434/v1",
      "api": "openai-completions",
      "apiKey": "none",
      "models": [
        { "id": "Qwen3.5-35B-A3B-GGUF" }
      ]
    },
    "anthropic": {
      "apiKey": "ANTHROPIC_KEY_PLACEHOLDER",
      "models": [
        { "id": "claude-opus-4-6" },
        { "id": "claude-sonnet-4-6" },
        { "id": "claude-haiku-4-5" }
      ]
    }
  }
}
MODELS_EOF

      # Replace placeholder with actual key
      if [ -n "$ANTHROPIC_KEY" ]; then
        ${pkgs.gnused}/bin/sed -i "s|ANTHROPIC_KEY_PLACEHOLDER|$ANTHROPIC_KEY|g" "$HOME/.pi/agent/models.json"
      fi
    fi
  '';

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
  };
}
