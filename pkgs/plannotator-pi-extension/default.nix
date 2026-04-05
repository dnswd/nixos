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
    export WRITABLE_SOURCE="$NIX_BUILD_TOP/source"
    mkdir -p "$WRITABLE_SOURCE"
    cp -r . "$WRITABLE_SOURCE/"
    cd "$WRITABLE_SOURCE"
    chmod -R +w .

    (cd apps/pi-extension && bash vendor.sh)
  '';

  installPhase = ''
    mkdir -p $out/lib/plannotator-pi-extension
    cp -r "$NIX_BUILD_TOP/source/apps/pi-extension/"* $out/lib/plannotator-pi-extension/
    rm -rf $out/lib/plannotator-pi-extension/node_modules 2>/dev/null || true
  '';

  meta = with lib; {
    description = "Plannotator extension for Pi - interactive plan review with visual annotation";
    homepage = "https://github.com/backnotprop/plannotator";
    license = with licenses; [ mit asl20 ];
    platforms = platforms.all;
  };
}
