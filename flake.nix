{
  description = "A very basic flake";

  nixConfig = {
    extra-substituters = [
      "https://nix-community.cachix.org"
      "https://nixpkgs-wayland.cachix.org"
    ];
    extra-trusted-public-keys = [
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
      "nixpkgs-wayland.cachix.org-1:3lwxaILxMRkVhehr5StQprHdEo4IrE8sRho9R9HOLYA="
    ];
  };

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/3c9922cd1a959342b353453573d36cf6eb655301";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # macOS support
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    # Theme
    catppuccin.url = "github:catppuccin/nix/b020a35938aa77cc93985b796e7b79623b98da60";
    catppuccin.inputs.nixpkgs.follows = "nixpkgs";

    # Neovim stuff
    nixvim.url = "github:nix-community/nixvim";
    nixvim.inputs.nixpkgs.follows = "nixpkgs";

    # Pinned nixpkgs for jdtls 1.43.0 (last version with Java 17 bytecode, compatible with Gradle 6.x)
    nixpkgs-jdtls.url = "github:nixos/nixpkgs/21808d22b1cda1898b71cf1a1beb524a97add2c4";

    # Pi-mono Agentic Copilot
    pi-mono = {
      url = "github:badlogic/pi-mono";
      flake = false;
    };
  };

  outputs =
    {
      nixpkgs,
      home-manager,
      nix-darwin,
      catppuccin,
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
        my = lib.my;
        pkgsDir = ./pkgs;
      };

      system = "x86_64-linux";
      pkgs = import nixpkgs {
        # this pkgs only used in this flake, per system pkgs see ./lib/hosts.nix
        config.allowUnfree = true;
        localSystem = { inherit system; };
      };
    in
    {
      formatter.${system} = pkgs.alejandra;

      inherit nixosConfigurations darwinConfigurations;
    };
}
