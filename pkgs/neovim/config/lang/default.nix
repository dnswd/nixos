{lib, ...}: {
  # Use the list of nix files in imports
  imports =
    [
      ./lua.nix
      ./markdown.nix
      ./nix.nix
      ./python.nix
      ./rust.nix
      ./shell.nix
      ./tex.nix
      ./web.nix
    ]
    ++ lib.my.mapModules ./.;
}
