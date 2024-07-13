{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # Theme
    catppuccin.url = "github:catppuccin/nix";

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
    tokyodark = {
      url = "github:tiagovla/tokyodark.nvim";
      flake = false;
    };
    session-manager = {
      url = "github:Shatur/neovim-session-manager";
      flake = false;
    };
    ntree-float = {
      url = "github:JMarkin/nvim-tree.lua-float-preview";
      flake = false;
    };
    buffer-manager = {
      url = "github:j-morano/buffer_manager.nvim";
      flake = false;
    };
    color-picker = {
      url = "github:ziontee113/color-picker.nvim";
      flake = false;
    };
    moveline = {
      url = "github:willothy/moveline.nvim";
      flake = false;
    };
    md-pdf = {
      url = "github:arminveres/md-pdf.nvim";
      flake = false;
    };
    windows = {
      url = "github:anuvyklack/windows.nvim";
      flake = false;
    };
    windows-mc = {
      url = "github:anuvyklack/middleclass";
      flake = false;
    };
    windows-a = {
      url = "github:anuvyklack/animation.nvim";
      flake = false;
    };
  };

  outputs = {
    self,
    nixpkgs,
    home-manager,
    catppuccin,
    nixvim,
    ...
  } @ inputs: let
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
        localSystem = {inherit system;};
      }
      // {
        overlays = [
          (final: prev: rec {
            # custom packages under pkgs.my
            my = lib.my.mapModules ./pkgs (p:
              prev.callPackage p {
                inherit inputs system;
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
    formatter.${system} = pkgs.alejandra;

    nixosConfigurations.${hostname} = nixpkgs.lib.nixosSystem {
      inherit system;
      modules = [
        (import ./configuration.nix (extraSpecialArgs // {inherit lib;}))
        catppuccin.nixosModules.catppuccin
        home-manager.nixosModules.home-manager
        {
          home-manager.useGlobalPkgs = true;
          home-manager.useUserPackages = true;
          home-manager.users.${username} = {
            imports =
              [
                ./home.nix
                catppuccin.homeManagerModules.catppuccin
                # nixvim.homeManagerModules.nixvim
              ]
              ++ lib.my.importFrom ./config;
          };
          home-manager.extraSpecialArgs = extraSpecialArgs;
        }
      ];
    };
  };
}
