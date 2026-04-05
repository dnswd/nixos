{ lib, stdenv, fetchgit, ... }:

stdenv.mkDerivation rec {
  pname = "plannotator-pi-extension";
  version = "0.16.7";

  src = fetchgit {
    url = "https://github.com/backnotprop/plannotator.git";
    # Using tag as recommended by cleanup plan (upstream has tags available)
    rev = "refs/tags/v${version}";
    hash = "";  # Empty to get correct hash from first build failure
  };

  # No nativeBuildInputs needed - pure TypeScript, no compilation
  # pi-mono uses jiti to load TypeScript directly

  dontConfigure = true;
  dontBuild = true;  # No build step

  installPhase = ''
    mkdir -p $out/lib/plannotator-pi-extension

    # Copy extension source from apps/pi-extension subdirectory
    cp -r ${src}/apps/pi-extension/* $out/lib/plannotator-pi-extension/

    # Clean up any node_modules from source (shouldn't exist, but just in case)
    rm -rf $out/lib/plannotator-pi-extension/node_modules 2>/dev/null || true

    # The skills are included at apps/pi-extension/skills/
    # They're automatically discovered by pi-mono via the pi.skills key in package.json
  '';

  meta = with lib; {
    description = "Plannotator extension for Pi - interactive plan review with visual annotation";
    homepage = "https://github.com/backnotprop/plannotator";
    license = with licenses; [ mit asl20 ];
    platforms = platforms.all;
  };
}
