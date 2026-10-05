{ self, pkgs, ... }:
{

  # List packages installed in system profile. To search by name, run:
  # $ nix-env -qaP | grep wget
  environment.systemPackages = [
    pkgs.vim
    pkgs.btop
    pkgs.surge-cli
  ];

  # Necessary for using flakes on this system.
  nix.settings.experimental-features = [
    "nix-command"
    "flakes"
  ];

  # Enable alternative shell support isn nix-darwin.
  programs.direnv.enable = true;

  # Set Git commit hash for darwin-version.
  system.configurationRevision = self.rev or self.dirtyRev or null;

  # Used for backwards compatibility, please read the changelog before changing.
  # $ darwin-rebuild changelog
  system.stateVersion = 6;

  # WORKAROUND: Disabling documentation to resolve an incompatibility between `nix-darwin/master`
  # and our pinned older `nixpkgs` version. `nix-darwin` passes `--sidebar-depth` to `nixos-render-docs`,
  # which our pinned `nixpkgs`' version of the tool does not support, causing build failures.
  #
  # This workaround can be safely removed once our main `nixpkgs` input is updated to a newer
  # revision containing the updated `nixos-render-docs` tool.
  documentation.enable = false;
  documentation.doc.enable = false;
  documentation.man.enable = false;
  documentation.info.enable = false;

  # Disable the uninstaller script as well, because it evaluates its own separate minimal nix-darwin
  # system configuration behind the scenes which defaults to having documentation enabled (re-triggering the failure).
  system.tools.darwin-uninstaller.enable = false;
  # The platform the configuration will be used on.
  nixpkgs.hostPlatform = "aarch64-darwin";

  # Declare user so home-manager can resolve homeDirectory
  users.users.oydennisalbaihaqi = {
    name = "oydennisalbaihaqi";
    home = "/Users/oydennisalbaihaqi";
  };

}
