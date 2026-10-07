{
  description = "A very basic flake";

  nixConfig = {
    extra-substituters = [
      "https://nix-community.cachix.org"
      "https://nixpkgs-wayland.cachix.org"
      "https://cache.numtide.com"
    ];
    extra-trusted-public-keys = [
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
      "nixpkgs-wayland.cachix.org-1:3lwxaILxMRkVhehr5StQprHdEo4IrE8sRho9R9HOLYA="
      "niks3.numtide.com-1:DTx8wZduET09hRmMtKdQDxNNthLQETkc/yaX7M4qK0g="
    ];
  };

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/0f3e3d903ea6cb54f137532e3be39111bc8dfcc5";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # macOS support
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    # Theme
    catppuccin.url = "github:catppuccin/nix";
    catppuccin.inputs.nixpkgs.follows = "nixpkgs";

    # Custom neovim
    halcyon-vim.url = "github:dnswd/vim";

    # Custom git commands
    git-sw.url = "github:dnswd/git-sw";

    # Oh-My-Pi coding agent
    omp.url = "github:can1357/oh-my-pi";

    # Pinned nixpkgs for jdtls 1.43.0 (last version with Java 17 bytecode, compatible with Gradle 6.x)
    nixpkgs-jdtls.url = "github:nixos/nixpkgs/21808d22b1cda1898b71cf1a1beb524a97add2c4";

    # Obsidian note taking
    obsidian-extensions = {
      url = "github:karaolidis/nix-obsidian-extensions";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # Secrets
    secretsPath = {
      url = "github:dnswd/nixos-secrets";
      flake = false;
    };

    # Helper
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      ...
    }@inputs:
    let
      lib = nixpkgs.lib.extend (
        final: prev: {
          # custom libs under lib.my
          my = import ./lib {
            inherit inputs;
            lib = final;
            pkgs = { }; # populated in ./lib/hosts
          };
        }
      );

      # Load all machines from machine/ directory
      machines = lib.my.loadMachines ./machine;

      # Separate machines by OS type (defaults to linux if not specified)
      linuxMachines = lib.filterAttrs (name: cfg: (cfg.metadata.osType or "linux") != "darwin") machines;
      darwinMachines = lib.filterAttrs (name: cfg: (cfg.metadata.osType or "linux") == "darwin") machines;

      # Generate configurations for all machines
      nixosConfigurations = lib.my.generateConfigurations {
        machines = linuxMachines;
      };

      darwinConfigurations = lib.my.generateDarwinConfigurations {
        machines = darwinMachines;
      };

    in
    (flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          # this pkgs only used in this flake, per system pkgs see ./lib/hosts.nix
          config.allowUnfree = true;
          localSystem = { inherit system; };
        };
      in
      {
        formatter = pkgs.alejandra;
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [ just ];
        };

      }
    ))
    // {
      inherit nixosConfigurations darwinConfigurations;
    };
}
