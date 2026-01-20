{
  lib,
  pkgs,
  inputs,
  ...
}:
with lib;
rec {
  # Supported shells - extensible list
  supportedShells = ["bash" "zsh" "fish" "dash"];
  darwinSupportedShells = ["bash" "zsh"];

  # Validate shell name per OS type
  # use throw for immediate per-machine error reporting
  validateShellForOS = osType: shell:
    let
      supported = if osType == "darwin"
                   then darwinSupportedShells
                   else supportedShells;
    in
    if elem shell supported
    then shell
    else throw "Unsupported shell '${shell}' for ${osType}. Supported: ${concatStringsSep ", " supported}";

  # Legacy shell validation (defaults to Linux)
  validateShell = shell:
    validateShellForOS "linux" shell;

  # Discover all machines from machine/ directory
  loadMachines = machineDir:
    let
      inherit (builtins) readDir;
      dirs = filterAttrs (n: v: v == "directory" && !hasPrefix "_" n) (readDir machineDir);
    in
    mapAttrs (name: _:
      let imported = import (machineDir + "/${name}/default.nix");
      in imported // {_machineDir = machineDir + "/${name}";}
    ) dirs;

  # Build users.users configuration from metadata
  # osType defaults to "linux" for backward compatibility
  buildUsersConfig = users: pkgs: osType:
    let
      osType' = if osType == null then "linux" else osType;
      # Validate: at least one user exists
      _ = assertMsg (length users > 0)
        "No users defined for this machine. Add at least one user.";

      # Validate: no duplicate usernames
      usernames = map (u: u.username) users;
      duplicates = filter (name:
        (length (filter (n: n == name) usernames)) > 1
      ) (unique usernames);
      _dup = assertMsg (duplicates == [])
        "Duplicate usernames detected: ${concatStringsSep ", " duplicates}";

      # Find all primary users and validate exactly 0 or 1
      primaryUsers = filter (u: u.isPrimaryUser or false) users;
      primaryUserCount = length primaryUsers;
      primaryUser = if primaryUserCount > 0 then head primaryUsers else null;

      # Enforce policy: at most one primary user
      _primary = assertMsg (primaryUserCount <= 1)
        "Multiple primary users declared: ${concatMapStringsSep ", " (u: u.username) primaryUsers}. Set isPrimaryUser=true for only one user.";

      primaryShell = if primaryUser != null then (primaryUser.shell or "bash") else "bash";

      # Validate shell names (Darwin has stricter shell support)
      validatedUsers = map (user:
        user // {shell = validateShellForOS osType' (user.shell or "bash");}
      ) users;

      # Build users.users attributes
      usersAttrs = listToAttrs (map (user:
        nameValuePair user.username {
          isNormalUser = true;
          description = user.description or user.username;
          shell = pkgs.${user.shell};
          extraGroups = user.extraGroups or [];
        }
      ) validatedUsers);
    in
    {
      users.users = usersAttrs;
      users.defaultUserShell = pkgs.${primaryShell};
      # Gracefully handle missing primary user
      services.displayManager.autoLogin = mkIf (primaryUser != null) {
        enable = true;
        user = primaryUser.username;
      };
    };

  # Generate all nixosConfigurations from machines
  generateConfigurations = {machines, nixpkgs, home-manager, catppuccin, lib, inputs, pkgsDir, my}:
    mapAttrs (hostname: machineConfig:
      let
        system = machineConfig.metadata.system;
        osType = machineConfig.metadata.osType or "linux";
        pkgs = import nixpkgs {

          # pkgs config per system
          config.allowUnfree = true;
          localSystem = {inherit system;};
          
          overlays = [
            (final: prev: {
              # custom packages under pkgs.my
              my = my.mapModules pkgsDir (p:
                prev.callPackage p {
                  inherit inputs system;
                  inherit (lib) my;
                });
            })
          ];
        };

        # Unified specialArgs for both system and home-manager (without pkgs)
        specialArgs = {
          inherit system inputs osType;
          hostname = machineConfig.metadata.hostname;
        };

        # Build home-manager configs from user homeConfig paths
        homeManagerConfigs = listToAttrs (map (user:
          nameValuePair user.username {
            imports = [
              catppuccin.homeModules.catppuccin
              user.homeConfig
            ];
          }
        ) machineConfig.users);
      in
      nixpkgs.lib.nixosSystem {
        inherit system specialArgs;
        modules = [
          # Properly set nixpkgs attributes for read-only module
          {
            nixpkgs.pkgs = pkgs;
            nixpkgs.hostPlatform = system;
          }
          # Use _machineDir to resolve configuration.nix (as module, not direct import)
          "${machineConfig._machineDir}/configuration.nix"
          home-manager.nixosModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.extraSpecialArgs = specialArgs;
            home-manager.users = homeManagerConfigs;
          }
          (buildUsersConfig machineConfig.users pkgs osType)
        ];
      }
    ) machines;

  # Generate all darwinConfigurations from machines
  generateDarwinConfigurations = {machines, nix-darwin, nixpkgs, home-manager, catppuccin, lib, inputs, pkgsDir, my}:
    mapAttrs (hostname: machineConfig:
      let
        system = machineConfig.metadata.system;
        osType = "darwin";
        pkgs = import nixpkgs {
          config.allowUnfree = true;
          inherit system;
          overlays = [
            (final: prev: {
              # custom packages under pkgs.my
              my = my.mapModules pkgsDir (p:
                prev.callPackage p {
                  inherit inputs system;
                  inherit (lib) my;
                });
            })
          ];
        };

        # Unified specialArgs for both system and home-manager (without pkgs)
        specialArgs = {
          inherit system inputs osType;
          hostname = machineConfig.metadata.hostname;
        };

        # Build home-manager configs from user homeConfig paths
        homeManagerConfigs = listToAttrs (map (user:
          nameValuePair user.username {
            imports = [
              catppuccin.homeModules.catppuccin
              user.homeConfig
            ];
          }
        ) machineConfig.users);
      in
      nix-darwin.lib.darwinSystem {
        inherit system specialArgs;
        modules = [
          # Set pkgs properly for Darwin
          { nixpkgs.pkgs = pkgs; }
          # Use _machineDir to resolve darwin-configuration.nix (as module)
          "${machineConfig._machineDir}/darwin-configuration.nix"
          home-manager.darwinModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.extraSpecialArgs = specialArgs;
            home-manager.users = homeManagerConfigs;
          }
          # Darwin doesn't use users.users, home-manager handles user creation
        ];
      }
    ) machines;
}
