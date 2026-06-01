default:
    @just --list

# === SECRETS SETUP ===
# Secrets are fetched from a private GitHub repo via FOD (Fixed Output Derivation)
# The secrets are baked into the build at build time and cached in the nix store.

# 1. Create a private repo at https://github.com/USER/REPO with secrets.json:
#    {
#      "fireworks_api_key": "fw_...",
#      "openrouter_api_key": "sk-or-v1-...",
#      "pi_auth": {"token": "..."},
#      "rbw_config": {"email": "..."},
#      "gitconfig": "[user]\n  name = ...\n  email = ..."
#    }

# 2. Edit config/secrets.nix and set:
#    - githubUser = "yourusername"
#    - repoName = "your-repo-name"

nix_conf := "~/.config/nix/nix.conf"

# Install GitHub access token into nix.conf (skips if already set)
token-install:
    #!/usr/bin/env bash
    set -euo pipefail

    NIX_CONF=$(eval echo "{{ nix_conf }}")

    if grep -q "access-tokens = github.com=" "$NIX_CONF" 2>/dev/null; then
        echo "access-tokens already set in $NIX_CONF, skipping. Use 'just token-update' to force."
    else
        TOKEN=$(gh auth token)
        [[ -n "$TOKEN" ]] || { echo "error: gh auth token returned nothing. Run 'gh auth login' first."; exit 1; }
        mkdir -p "$(dirname "$NIX_CONF")"
        echo "access-tokens = github.com=$TOKEN" >> "$NIX_CONF"
        echo "Token written to $NIX_CONF."
    fi

# Updates GitHub access token inside nix.conf (force)
token-update:
    #!/usr/bin/env bash
    set -euo pipefail

    NIX_CONF=$(eval echo "{{ nix_conf }}")

    TOKEN=$(gh auth token)
    [[ -n "$TOKEN" ]] || { echo "error: gh auth token returned nothing. Run 'gh auth login' first."; exit 1; }

    mkdir -p "$(dirname "$NIX_CONF")"

    if grep -q "access-tokens = github.com=" "$NIX_CONF" 2>/dev/null; then
        sed -i "s|^access-tokens = github.com=.*|access-tokens = github.com=$TOKEN|" "$NIX_CONF"
        echo "Token replaced in $NIX_CONF."
    else
        echo "access-tokens = github.com=$TOKEN" >> "$NIX_CONF"
        echo "Token written to $NIX_CONF."
    fi

