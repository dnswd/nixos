# Default recipe
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
#    - secretsHash = (from step 3)

# Get the sha256 hash for your private repo (uses `gh auth token` for auth)
prefetch-secrets REPO="nixos-secrets" USERNAME="dnswd" BRANCH="main":
    #!/usr/bin/env bash
    URL="https://raw.githubusercontent.com/{{USERNAME}}/{{REPO}}/{{BRANCH}}/secrets.json"
    TOKEN=$(gh auth token)
    if [[ -z "$TOKEN" ]]; then
        echo "Error: Could not get GitHub token from 'gh auth token'"
        echo "Ensure you're logged in: gh auth login"
        exit 1
    fi
    echo "Fetching from: $URL"
    nix-prefetch-url --header "Authorization: Bearer $TOKEN" "$URL"

# Rebuild NixOS or Darwin system (uses `gh auth token` for secrets auth)
switch *args="":
    #!/usr/bin/env bash
    set -e
    GITHUB_TOKEN=$(gh auth token)
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo "Error: Could not get GitHub token from 'gh auth token'"
        echo "Ensure you're logged in: gh auth login"
        exit 1
    fi
    export GITHUB_TOKEN
    if [[ "$(uname -s)" == "Darwin" ]]; then
        sudo -E darwin-rebuild switch --flake .\#dennis-macbook-pro --impure {{args}}
    else
        sudo -E nixos-rebuild switch --flake .\#ikigai --impure {{args}}
    fi
