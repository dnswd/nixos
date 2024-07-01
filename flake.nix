{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    catppuccin.url = "github:catppuccin/nix";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
    # nixvim.url = "github:nix-community/nixvim";
    # nixvim.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, home-manager, catppuccin, nixvim, ... }@inputs: let
    system = "x86_64-linux";
    hostname = "ikigai";
    username = "halcyon";

    lib = nixpkgs.lib.extend (final: prev: {
      my = import ./lib {
        inherit pkgs inputs;
        lib = final;
      };
    });

    pkgs = import nixpkgs ({
      config.allowUnfree = true;
      config.warnUndeclaredOptions = true;
      localSystem = {inherit system;};
    } // {
      overlays = [
        (final: prev: rec {
          # custom packages under pkgs.my
          my = lib.my.mapModules ./pkgs (p:
            prev.callPackage p {
              inherit inputs;
              inherit (lib) my;
            });
        })
      ];
    });

    extraSpecialArgs = {
      inherit pkgs system hostname username;
      inherit (lib) my;
    };

  in rec {
    nixosConfigurations.${hostname} = nixpkgs.lib.nixosSystem {
      inherit system;
      modules = [
        ./configuration.nix
        catppuccin.nixosModules.catppuccin
        home-manager.nixosModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.users.${username} = {
              imports = [
                ./home.nix
                catppuccin.homeManagerModules.catppuccin
                # nixvim.homeManagerModules.nixvim
              ] ++ lib.my.importFrom ./home;
            };
            home-manager.extraSpecialArgs = extraSpecialArgs;
          }
      ];
    };
  };
}
