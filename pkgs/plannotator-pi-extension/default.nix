{ lib, stdenv, fetchgit, bash, ... }:

stdenv.mkDerivation rec {
  pname = "plannotator-pi-extension";
  version = "0.16.7";

  src = fetchgit {
    url = "https://github.com/backnotprop/plannotator.git";
    # Using tag as recommended by cleanup plan (upstream has tags available)
    rev = "refs/tags/v${version}";
    hash = "sha256-1SHn2QSyuVAuIG7s4/eel6C59iouMTRE72hPIkUzbYo=";
  };

  nativeBuildInputs = [ bash ];

  dontConfigure = true;

  buildPhase = ''
    # The source was unpacked to $sourceRoot (detected by stdenv as 'plannotator')
    # Copy to a writable location so we can run vendor.sh
    cp -r "$sourceRoot" ./source
    chmod -R +w ./source

    # Run vendor.sh to generate the generated/ directory
    # vendor.sh references ../../packages/ from apps/pi-extension
    # Use subshell so directory change doesn't affect installPhase
    (cd ./source/apps/pi-extension && bash vendor.sh)
  '';

  installPhase = ''
    mkdir -p $out/lib/plannotator-pi-extension

    # Copy built extension source
    cp -r ./source/apps/pi-extension/* $out/lib/plannotator-pi-extension/

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
