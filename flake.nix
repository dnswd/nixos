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
    nix-colors.url = "github:misterio77/nix-colors";

    # Neovim stuff
    nixvim.url = "github:nix-community/nixvim";
    nixvim.inputs.nixpkgs.follows = "nixpkgs";
    ts-comments = {
      url = "github:folke/ts-comments.nvim";
      flake = false;
    };
    nvim-md = {
      url = "github:ixru/nvim-markdown";
      flake = false;
    };
    nvim-hl-md = {
      url = "github:yaocccc/nvim-hl-mdcodeblock.lua";
      flake = false;
    };
  };

  outputs =
    { nixpkgs
    , home-manager
    , nix-darwin
    , nix-colors
    , ...
    } @ inputs:
    let
      lib = nixpkgs.lib.extend (final: prev: {
        # custom libs under lib.my
        my = import ./lib {
          inherit inputs;
          lib = final;
          pkgs = {}; # populated in ./lib/hosts
        };
      });

      # Load all machines from machine/ directory
      machines = lib.my.loadMachines ./machine;

      # Separate machines by OS type (defaults to linux if not specified)
      linuxMachines = lib.filterAttrs (name: cfg: (cfg.metadata.osType or "linux") != "darwin") machines;
      darwinMachines = lib.filterAttrs (name: cfg: (cfg.metadata.osType or "linux") == "darwin") machines;

      # Generate configurations for all machines
      nixosConfigurations = lib.my.generateConfigurations {
        machines = linuxMachines;
        inherit nixpkgs home-manager nix-colors;
        inherit lib inputs;
        my = lib.my;
        pkgsDir = ./pkgs;
      };

      darwinConfigurations = lib.my.generateDarwinConfigurations {
        machines = darwinMachines;
        inherit nix-darwin nixpkgs home-manager nix-colors;
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
