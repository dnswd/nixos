{ pkgs, ... }:
let
  scriptsDir = ../scripts;

  # Install scripts to nix store to make it available for all users
  myScripts = pkgs.stdenvNoCC.mkDerivation {
    name = "my-scripts";
    src = scriptsDir;
    installPhase = ''
      mkdir -p $out/bin
      for script in $src/*; do
        install -Dm755 "$script" "$out/bin/$(basename "$script")"
      done
    '';
  };
in
{
  home.packages = [ myScripts ];
}
