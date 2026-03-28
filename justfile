# Default recipe
default:
    @just --list

# Re-encrypt all secrets (after adding new keys to secrets.nix)
rekey:
    @echo "Re-encrypting all secrets with current keys..."
    cd secrets && agenix -r
    @echo "Done."

# Edit a secret file
edit file:
    cd secrets && agenix -e {{file}}.age

# Edit git config secret
edit-git:
    cd secrets && agenix -e gitconfig.age

# Edit rbw config secret
edit-rbw:
    cd secrets && agenix -e rbw-config.json.age

# Edit pi-mono auth secret
edit-pi:
    cd secrets && agenix -e pi-auth.json.age

# Initialize secrets from examples
init:
    @echo "Creating secret files from examples..."
    @for f in secrets/*.example; do \
        target="$${f%.example}"; \
        if [ ! -f "$$target.age" ]; then \
            echo "Creating $$target.age from $$f"; \
            cp "$$f" "$${f%.example}"; \
            cd secrets && agenix -e "$$(basename $$target).age"; \
            rm "$${f%.example}"; \
        else \
            echo "$$target.age already exists, skipping"; \
        fi \
    done
    @echo "Done. Run 'just rekey' if you added new keys."

# Rebuild system
rebuild *args="":
    #!/usr/bin/env bash
    set -e
    if [[ "$(uname -s)" == "Darwin" ]]; then
        cmd="darwin-rebuild switch --flake .\#dennis-macbook-pro"
    else
        cmd="nixos-rebuild switch --flake .\#dennis-macbook-pro"
    fi
    
    $cmd {{args}}
