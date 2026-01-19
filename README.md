# My NixOS Config 

[![Visits Badge](https://badges.pufler.dev/visits/dnswd/nixos)](https://github.com/dnswd/nixos/)

You can take ideas, but I'm not responsible for any issues that may arise.

## Multi-Machine Configuration

This repository implements a pragmatic, metadata-driven approach to managing multiple NixOS machines with different users.

### Quick Start

**For a single machine**: Your configuration is in `machine/ikigai/`

**For multiple machines**: See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed documentation.

### Key Files

- `flake.nix` - Flake definition with multi-machine support
- `machine/*/default.nix` - Per-machine metadata (users, hostname, system)
- `machine/*/configuration.nix` - NixOS system configuration
- `home/*.nix` - Per-user home-manager configurations
- `lib/hosts.nix` - Multi-machine management utilities

### Basic Commands

```bash
# Show all configured machines
nix flake show

# Validate configuration
nix flake check

# Build system (dry)
nixos-rebuild dry-build --flake .#ikigai

# Build and switch
sudo nixos-rebuild switch --flake .#ikigai
```

### Adding a Machine

See [ARCHITECTURE.md - Adding a Second Machine](ARCHITECTURE.md#adding-a-second-machine)

### Configuration Structure

```
.
├── machine/ikigai/          # Machine configuration
│   ├── default.nix          # Metadata + users
│   ├── configuration.nix    # System config
│   └── hardware-configuration.nix
├── home/                    # Home-manager configs
│   ├── halcyon.nix
│   └── guest.nix
├── lib/hosts.nix            # Multi-machine utilities
└── flake.nix                # Flake definition
```
