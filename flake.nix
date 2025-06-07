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
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.05";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # Theme
    catppuccin.url = "github:catppuccin/nix";

    # Hyprland
    hyprland.url = "github:hyprwm/Hyprland";

    # Neovim stuff
    nixvim.url = "github:nix-community/nixvim";
    # nixvim.inputs.nixpkgs.follows = "nixpkgs";
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

    # Minecraft
    # polymc.url = "github:PolyMC/PolyMC";
  };

  outputs =
    { nixpkgs
    , home-manager
    , catppuccin
    , ...
    } @ inputs:
    let
      system = "x86_64-linux";
      hostname = "ikigai";
      username = "halcyon";

      lib = nixpkgs.lib.extend (final: prev: {
        # custom libs under lib.my
        my = import ./lib {
          inherit pkgs inputs;
          lib = final;
        };
      });

      pkgs = import nixpkgs ({
        config.allowUnfree = true;
        config.warnUndeclaredOptions = true;
        localSystem = { inherit system; };
      }
      // {
        overlays = [
          (final: prev: {
            # custom packages under pkgs.my
            my = lib.my.mapModules ./pkgs (p:
              prev.callPackage p {
                inherit inputs system;
                inherit (lib) my;
              });
            hyprland = inputs.hyprland.packages.${system};
          })
          # inputs.polymc.overlay
        ];
      });

      extraSpecialArgs = {
        inherit pkgs system hostname username;
        inherit (lib) my;
      };
    in
    {
      formatter.${system} = pkgs.alejandra;

      nixosConfigurations.${hostname} = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          (import ./configuration.nix (extraSpecialArgs // { inherit lib; }))
          catppuccin.nixosModules.catppuccin
          home-manager.nixosModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.users.${username} = {
              imports =
                [
                  ./home.nix
                  catppuccin.homeModules.catppuccin
                ]
                ++ lib.my.importFrom ./config;
            };
            home-manager.extraSpecialArgs = extraSpecialArgs;
          }
        ];
      };
    };
}
