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
    nixpkgs.url = "github:nixos/nixpkgs/711ab3d132e5d30803ffad7cf7095bfb1dab44d9";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # macOS support
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    # Theme
    catppuccin.url = "github:catppuccin/nix/b020a35938aa77cc93985b796e7b79623b98da60";
    catppuccin.inputs.nixpkgs.follows = "nixpkgs";

    # Custom neovim
    halcyon-vim.url = "github:dnswd/vim";

    # Pinned nixpkgs for jdtls 1.43.0 (last version with Java 17 bytecode, compatible with Gradle 6.x)
    nixpkgs-jdtls.url = "github:nixos/nixpkgs/21808d22b1cda1898b71cf1a1beb524a97add2c4";

    # Pi coding agent from numtide (binary cache, no local builds)
    llm-agents.url = "github:numtide/llm-agents.nix";

    # Secrets
    secretsPath = {
      url = "github:dnswd/nixos-secrets";
      flake = false;
    };
  };

  outputs =
    {
      nixpkgs,
      home-manager,
      nix-darwin,
      catppuccin,
      secretsPath,
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
        inherit nixpkgs home-manager catppuccin;
        inherit lib inputs;
        inherit secretsPath secrets;
        my = lib.my;
        pkgsDir = ./pkgs;
      };

      darwinConfigurations = lib.my.generateDarwinConfigurations {
        machines = darwinMachines;
        inherit
          nix-darwin
          nixpkgs
          home-manager
          catppuccin
          ;
        inherit lib inputs;
        inherit secretsPath secrets;
        my = lib.my;
        pkgsDir = ./pkgs;
      };

      system = "x86_64-linux";
      pkgs = import nixpkgs {
        # this pkgs only used in this flake, per system pkgs see ./lib/hosts.nix
        config.allowUnfree = true;
        localSystem = { inherit system; };
      };

      secrets = import "${secretsPath}/secrets.nix";
    in
    {
      formatter.${system} = pkgs.alejandra;
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = with pkgs; [ just ];
      };

      inherit nixosConfigurations darwinConfigurations;
    };
}
