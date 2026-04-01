{ lib, pkgs, stdenv, nodejs, fetchgit }:

# pi-listen extension built with pnpm (includes platform-specific native bindings)
stdenv.mkDerivation rec {
  pname = "pi-listen";
  version = "5.0.0";

  src = fetchgit {
    url = "https://github.com/codexstar69/pi-listen.git";
    rev = "refs/tags/v${version}";
    hash = "sha256-mAemsCcWCgMhNw/kO3r8S2yd00HXZyVy5qX55q07XDM=";
  };

  nativeBuildInputs = [ nodejs pkgs.pnpm pkgs.cacert ];

  # Don't use the sourceRoot trick since we need the full repo
  dontSetSourceRoot = true;

  buildPhase = ''
    export HOME=$TMPDIR
    export PNPM_HOME=$TMPDIR/pnpm
    export PATH=$PNPM_HOME:$PATH
    export NODE_OPTIONS="--use-openssl-ca"

    # Install dependencies (this downloads platform-specific sherpa-onnx-node)
    # No frozen-lockfile since repo uses bun.lock not pnpm-lock.yaml
    pnpm install 2>&1

    # Verify sherpa-onnx-node native binding was downloaded
    ls -la node_modules/sherpa-onnx-node/ || echo "sherpa-onnx-node not found"
    find node_modules -name "sherpa-onnx.node" 2>/dev/null || echo "native binding not found"
  '';

  installPhase = ''
    mkdir -p $out/lib/pi-listen

    # Copy essential extension files
    cp -r extensions $out/lib/pi-listen/
    cp package.json $out/lib/pi-listen/

    # Copy node_modules with native bindings
    cp -r node_modules $out/lib/pi-listen/

    # Remove unnecessary files to save space
    rm -rf $out/lib/pi-listen/node_modules/.cache 2>/dev/null || true
    rm -rf $out/lib/pi-listen/node_modules/.bin 2>/dev/null || true
    rm -rf $out/lib/pi-listen/node_modules/.pnpm 2>/dev/null || true
  '';

  meta = with lib; {
    description = "pi-listen voice input extension for pi-mono";
    homepage = "https://github.com/codexstar69/pi-listen";
    license = licenses.mit;
    platforms = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
  };
}
