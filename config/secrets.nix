# Secrets via Fixed Output Derivation (FOD) from private GitHub repo
{ config, pkgs, lib, ... }:
let
  githubUser = "dnswd";
  repoName = "nixos-secrets";  # Change to your private repo name
  branch = "master";
  secretsHash = "sha256-6/GfILplr19oU06xW6Tp+EtWRUKgev87JblC5O3jWkQ=";  # Update with: nix-prefetch-url --header "Authorization: Bearer $(gh auth token)" URL
  githubToken = builtins.getEnv "GITHUB_TOKEN";
  
  secretsJson = pkgs.fetchurl {
    name = "secrets.json";
    url = "https://raw.githubusercontent.com/${githubUser}/${repoName}/${branch}/secrets.json";
    sha256 = secretsHash;
    curlOptsList = lib.optionals (githubToken != "") [
      "-H" "Authorization: Bearer ${githubToken}"
    ];
  };
  
  secretsDir = "${config.home.homeDirectory}/.config/nixos-secrets";
in
{
  _module.args = {
    secretsJson = secretsJson;
    readSecret = name: "!${pkgs.jq}/bin/jq -r '.${name} // empty' ${secretsJson}";
  };
  
  home.activation.writeSecrets = lib.hm.dag.entryAfter ["writeBoundary"] ''
    JQ=${pkgs.jq}/bin/jq
    SECRETS_JSON="${secretsJson}"
    SECRETS_DIR="${secretsDir}"
    
    mkdir -p "$SECRETS_DIR"
    
    # Write sourceable env file for shells
    FW_KEY=$($JQ -r '.fireworks_api_key // empty' "$SECRETS_JSON")
    OR_KEY=$($JQ -r '.openrouter_api_key // empty' "$SECRETS_JSON")
    cat > "$SECRETS_DIR/env.sh" << EOF
export FIREWORKS_API_KEY="$FW_KEY"
export OPENROUTER_API_KEY="$OR_KEY"
EOF
    chmod 600 "$SECRETS_DIR/env.sh"
    
    writeSecretFile() {
      local dir="$1"
      local file="$2"
      local content="$3"
      if [[ -L "$file" ]] || [[ -f "$file" ]]; then
        rm -f "$file"
      fi
      mkdir -p "$dir"
      printf '%s' "$content" > "$file"
      chmod 600 "$file"
    }
    
    PI_AUTH=$($JQ -r '.pi_auth // empty' "$SECRETS_JSON")
    if [[ -n "$PI_AUTH" ]]; then
      writeSecretFile \
        "${config.home.homeDirectory}/.pi/agent" \
        "${config.home.homeDirectory}/.pi/agent/auth.json" \
        "$PI_AUTH"
    fi
    
    RBW_EMAIL=$($JQ -r '.rbw_config.email // empty' "$SECRETS_JSON")
    if [[ -n "$RBW_EMAIL" ]]; then
      # Construct full rbw config with secret email + static settings
      ${pkgs.jq}/bin/jq -n \
        --arg email "$RBW_EMAIL" \
        --arg pinentry "${if config.wayland.windowManager.hyprland.enable then "${pkgs.pinentry-gtk2}/bin/pinentry-gtk-2" else "${pkgs.pinentry-gnome3}/bin/pinentry"}" \
        '{email: $email, lock_timeout: 3600, pinentry: $pinentry}' \
        > "${config.xdg.configHome}/rbw/config.json"
      chmod 600 "${config.xdg.configHome}/rbw/config.json"
    fi
    
    GITCONFIG=$($JQ -r '.gitconfig // empty' "$SECRETS_JSON")
    if [[ -n "$GITCONFIG" ]]; then
      writeSecretFile \
        "${config.home.homeDirectory}/.config/git" \
        "${config.home.homeDirectory}/.config/git/config.secret" \
        "$GITCONFIG"
    fi
  '';
}
