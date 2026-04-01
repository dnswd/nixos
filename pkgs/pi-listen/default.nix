{ lib, pkgs, stdenv, nodejs, fetchgit }:

# pi-listen extension built with npm (includes platform-specific native bindings)
stdenv.mkDerivation rec {
  pname = "pi-listen";
  version = "5.0.0";

  src = fetchgit {
    url = "https://github.com/codexstar69/pi-listen.git";
    rev = "refs/tags/v${version}";
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  nativeBuildInputs = [ nodejs ];

  # Don't use the sourceRoot trick since we need the full repo
  dontSetSourceRoot = true;

  buildPhase = ''
    export HOME=$TMPDIR
    export npm_config_cache=$TMPDIR/npm-cache
    
    # Install dependencies (this downloads platform-specific sherpa-onnx-node)
    npm ci 2>&1 || npm install 2>&1
    
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
  '';

  meta = with lib; {
    description = "pi-listen voice input extension for pi-mono";
    homepage = "https://github.com/codexstar69/pi-listen";
    license = licenses.mit;
    platforms = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
  };
}
