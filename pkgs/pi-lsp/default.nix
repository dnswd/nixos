{
  lib,
  pkgs,
  stdenv,
  nodejs,
  fetchgit,
  bun,
  cacert,
  git,
  ...
}:

let
  # FOD to fetch dependencies with bun (network access allowed in FOD with hash)
  nodeModules = stdenv.mkDerivation {
    name = "pi-lsp-node-modules";

    src = fetchgit {
      url = "https://github.com/dreki-gg/pi-extensions.git";
      rev = "160b885a41562acaead53384dcad4869f143d6ad";
      hash = "sha256-0Qotnxyz9YrtLCQ9zCbJFk+CkxKYtCfEH0ziLPNzKto=";
    };

    # Allow network access in FOD (hash ensures reproducibility)
    impureEnvVars = lib.fetchers.proxyImpureEnvVars ++ [
      "GIT_CONFIG_GLOBAL"
      "NIX_NPM_REGISTRY"
    ];
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-1478bPxu38Im984FClhNT+g75J/9gbutVyVB+lDXLqM=";

    preferLocalBuild = true;

    nativeBuildInputs = [
      bun
      cacert
      git
    ];

    buildPhase = ''
      export HOME=$TMPDIR

      # Navigate to the LSP package directory
      cd packages/lsp

      # bun install respects bun.lock (frozen lockfile by default)
      bun install --no-cache

      # Copy to output (including .bun directory for deduplication symlinks)
      mkdir -p $out
      cp -r node_modules $out/
      cp -r node_modules/.bun $out/node_modules/ 2>/dev/null || true
      cp package.json $out/
    '';

    dontInstall = true;
    dontFixup = true;
  };
in

stdenv.mkDerivation rec {
  pname = "pi-lsp";
  version = "0.1.0";

  src = fetchgit {
    url = "https://github.com/dreki-gg/pi-extensions.git";
    rev = "160b885a41562acaead53384dcad4869f143d6ad";
    hash = "sha256-f1kQaN6O4Tf5Aj0losG6psmFQ3n3YTBdKcADWTyKsSI=";
  };

  nativeBuildInputs = [ nodejs ];

  dontConfigure = true;

  buildPhase = ''
    # Navigate to the LSP package directory
    cd packages/lsp

    # Copy pre-fetched node_modules from FOD
    cp -r ${nodeModules}/node_modules .
  '';

  installPhase = ''
    mkdir -p $out/lib/pi-lsp

    # Copy extension files (from packages/lsp)
    cp -r extensions $out/lib/pi-lsp/
    cp package.json $out/lib/pi-lsp/

    # Copy node_modules (including .bun directory for deduplication symlinks)
    cp -r node_modules $out/lib/pi-lsp/
    cp -r node_modules/.bun $out/lib/pi-lsp/node_modules/ 2>/dev/null || true

    # Clean up cache files to save space (keep .bin for CLI tools)
    rm -rf $out/lib/pi-lsp/node_modules/.cache 2>/dev/null || true
    rm -rf $out/lib/pi-lsp/node_modules/.bun/.cache 2>/dev/null || true
  '';

  # Disable broken symlinks check (bun uses symlinks to .bun directory)
  dontFixup = true;

  meta = with lib; {
    description = "pi LSP extension for language server protocol support";
    homepage = "https://github.com/dreki-gg/pi-extensions";
    license = licenses.mit;
    platforms = [
      "aarch64-darwin"
      "x86_64-darwin"
      "aarch64-linux"
      "x86_64-linux"
    ];
  };
}
