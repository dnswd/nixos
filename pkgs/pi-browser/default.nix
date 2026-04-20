{
  lib,
  stdenv,
  nodejs,
  pnpm_10,
  cacert,
  ...
}:

let
  # FOD for pnpm dependencies (network access allowed in FOD with hash)
  nodeModules = stdenv.mkDerivation {
    name = "pi-browser-node-modules";

    src = builtins.path {
      name = "pi-browser-src";
      path = ./src;
      filter = path: type: true;
    };

    # Allow network access in FOD (hash ensures reproducibility)
    impureEnvVars = lib.fetchers.proxyImpureEnvVars ++ [
      "NIX_NPM_REGISTRY"
      "SSL_CERT_FILE"
    ];
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = {
      aarch64-darwin = "sha256-vzVqtY5oTvY7WpQEZR+7hUO2zSu+ic3cncex0nFh+g8=";
      x86_64-darwin = "sha256-vzVqtY5oTvY7WpQEZR+7hUO2zSu+ic3cncex0nFh+g8=";
      aarch64-linux = "sha256-LDse69imKURQiBuSAFvcdd7RPaBBBmji2suCAWLA9Qk=";
      x86_64-linux = "sha256-LDse69imKURQiBuSAFvcdd7RPaBBBmji2suCAWLA9Qk=";
    }.${stdenv.hostPlatform.system} or (throw "Unsupported platform: ${stdenv.hostPlatform.system}");

    preferLocalBuild = true;

    nativeBuildInputs = [
      pnpm_10
      cacert
    ];

    dontConfigure = true;

    buildPhase = ''
      export HOME=$TMPDIR

      # pnpm install without frozen lockfile (local source, lockfile may be outdated)
      pnpm install
    '';

    installPhase = ''
      mkdir -p $out

      # Copy node_modules (pnpm uses content-addressable store via symlinks)
      cp -r node_modules $out/
      cp package.json $out/
      cp pnpm-lock.yaml $out/ 2>/dev/null || true
    '';

    dontFixup = true; # Skip broken symlink check (pnpm uses symlinks)
  };
in

stdenv.mkDerivation rec {
  pname = "pi-browser";
  version = "1.0.0";

  src = builtins.path {
    name = "pi-browser-src";
    path = ./src;
    filter = path: type: true;
  };

  nativeBuildInputs = [ nodejs ];

  dontConfigure = true;
  dontFixup = true; # Skip broken symlink check (pnpm creates symlinks)

  buildPhase = ''
    # Copy pre-fetched node_modules from FOD
    cp -r ${nodeModules}/node_modules .
    cp ${nodeModules}/package.json ./
    cp ${nodeModules}/pnpm-lock.yaml ./ 2>/dev/null || true
  '';

  installPhase = ''
    mkdir -p $out/lib/pi-browser

    # Copy source files
    cp -r src $out/lib/pi-browser/
    cp package.json $out/lib/pi-browser/
    cp -r node_modules $out/lib/pi-browser/

    # Clean up cache files to save space
    rm -rf $out/lib/pi-browser/node_modules/.cache 2>/dev/null || true
  '';

  meta = with lib; {
    description = "Browser automation extension for pi-mono using Chrome DevTools Protocol";
    license = licenses.mit;
    platforms = [
      "aarch64-darwin"
      "x86_64-darwin"
      "aarch64-linux"
      "x86_64-linux"
    ];
  };
}
