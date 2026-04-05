{ lib, pkgs, stdenv, nodejs, fetchgit, pnpm, bun, cacert, git, ... }:

let
  # FOD to fetch dependencies with bun (network access allowed in FOD with hash)
  nodeModules = stdenv.mkDerivation {
    name = "pi-listen-node-modules";

    src = fetchgit {
      url = "https://github.com/codexstar69/pi-listen.git";
      rev = "refs/tags/v5.0.0";
      hash = "sha256-mAemsCcWCgMhNw/kO3r8S2yd00HXZyVy5qX55q07XDM=";
    };

    # Allow network access in FOD (hash ensures reproducibility)
    impureEnvVars = lib.fetchers.proxyImpureEnvVars ++ [ "GIT_CONFIG_GLOBAL" "NIX_NPM_REGISTRY" ];
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-UE9fBGMruurCqAnm3SnpahEAa6RvPN+gyQvDYoLyaBY=";

    preferLocalBuild = true;

    nativeBuildInputs = [ bun cacert git ];

    buildPhase = ''
      export HOME=$TMPDIR

      # bun install respects bun.lock (frozen lockfile by default)
      bun install --no-cache

      # Copy to output
      mkdir -p $out
      cp -r node_modules $out/
      cp package.json $out/
    '';

    dontInstall = true;
    dontFixup = true;
  };
in

stdenv.mkDerivation rec {
  pname = "pi-listen";
  version = "5.0.0";

  src = fetchgit {
    url = "https://github.com/codexstar69/pi-listen.git";
    rev = "refs/tags/v${version}";
    hash = "sha256-mAemsCcWCgMhNw/kO3r8S2yd00HXZyVy5qX55q07XDM=";
  };

  nativeBuildInputs = [ nodejs ];

  dontConfigure = true;

  buildPhase = ''
    # Copy pre-fetched node_modules from FOD
    cp -r ${nodeModules}/node_modules .
  '';

  installPhase = ''
    mkdir -p $out/lib/pi-listen

    # Copy extension files
    cp -r extensions $out/lib/pi-listen/
    cp package.json $out/lib/pi-listen/

    # Copy node_modules
    cp -r node_modules $out/lib/pi-listen/

    # Clean up cache files to save space (keep .bin for CLI tools)
    rm -rf $out/lib/pi-listen/node_modules/.cache 2>/dev/null || true
  '';

  meta = with lib; {
    description = "pi-listen voice input extension for pi-mono";
    homepage = "https://github.com/codexstar69/pi-listen";
    license = licenses.mit;
    platforms = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
  };
}
