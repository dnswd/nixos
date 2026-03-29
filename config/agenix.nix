# Agenix (secrets management) - Home Manager Configuration Module
#
# This module configures the agenix home-manager integration. It does NOT
# declare secrets themselves - those are owned by their domain modules.
#
# ---------------------------------------------------------------------------
# SECRETS MANAGEMENT ARCHITECTURE
# ---------------------------------------------------------------------------
#
# 1. ENCRYPTION PHASE (manual, via agenix CLI)
#    - secrets.nix: Declares which SSH public keys can decrypt each secret
#    - *.age files: Encrypted secrets stored in secrets/ directory
#
# 2. DECRYPTION PHASE (automatic, via home-manager)
#    - This module: Configures the private key path for decryption
#    - Domain modules: Each declares its own age.secrets.* entries
#
# ---------------------------------------------------------------------------
# PER-DOMAIN SECRET OWNERSHIP
# ---------------------------------------------------------------------------
#
# Following the pattern where each config module owns its secrets:
#
#   config/devel/git.nix        -> gitconfig.age
#   config/bitwarden.nix        -> rbw-config.json.age
#   config/devel/pi-mono/*.nix  -> pi-auth.json.age, fireworks-api-key.age
#
# Domain modules import this file to get the identityPaths setting, then
# declare their own age.secrets entries with:
#   - file: path to the .age file in secrets/
#   - path: (optional) where to decrypt the secret on activation
#
# ---------------------------------------------------------------------------

{ config, ... }:

{
  age = {
    # The SSH private key used to decrypt all age secrets on this machine.
    # This key must have a corresponding public key listed in secrets.nix
    # for each secret you want to decrypt.
    identityPaths = [ "${config.home.homeDirectory}/.ssh/id_rsa" ];
  };
}
