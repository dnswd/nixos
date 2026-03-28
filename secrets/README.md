# Secrets Management with Agenix

This directory contains encrypted secrets managed by [agenix](https://github.com/ryantm/agenix).

## Setup

1. Create your `identity.json` from the example:
   ```bash
   cp secrets/identity.json.example secrets/identity.json
   # Edit with your actual values (name, emails, API keys)
   ```

2. Encrypt the file:
   ```bash
   cd secrets
   nix run github:ryantm/agenix -- -e identity.json.age < identity.json
   ```

   Or interactively:
   ```bash
   nix run github:ryantm/agenix -- -e identity.json.age
   # Paste contents and save
   ```

3. Delete the unencrypted file:
   ```bash
   rm secrets/identity.json
   ```

4. Commit the encrypted file:
   ```bash
   git add secrets/identity.json.age
   ```

## Re-keying

If you add new SSH keys to `secrets.nix`, re-encrypt all secrets:
```bash
cd secrets
nix run github:ryantm/agenix -- -r
```

## Editing Secrets

To edit an existing encrypted secret:
```bash
cd secrets
nix run github:ryantm/agenix -- -e identity.json.age
```

## File Structure

- `secrets.nix` - Defines which public keys can decrypt each secret
- `identity.json.age` - Encrypted identity data (safe to commit)
- `identity.json.example` - Template showing expected JSON structure

## How It Works

At system activation, agenix decrypts `identity.json.age` to `/run/agenix/identity`.
Home-manager activation scripts then read this JSON to configure:
- Git user name/email
- Bitwarden email
- Pi-mono API keys
