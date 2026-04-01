{ lib, pkgs, stdenv, nodejs }:

stdenv.mkDerivation rec {
  pname = "sherpa-onnx-node";
  version = "1.12.34";

  src = pkgs.fetchFromGitHub {
    owner = "k2-fsa";
    repo = "sherpa-onnx";
    rev = "v${version}";
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  sourceRoot = "source/nodejs-addon";

  nativeBuildInputs = [ nodejs pkgs.nodePackages.node-gyp ];
  buildInputs = [ nodejs ] ++ lib.optionals stdenv.isLinux [ pkgs.alsa-lib ];

  # Use pre-built sherpa-onnx instead of building from source
  preBuild = ''
    export HOME=$TMPDIR
    # Link to pre-built sherpa-onnx
    mkdir -p deps
    cp -r ${pkgs.callPackage ../sherpa-onnx { }}/lib/* deps/ 2>/dev/null || true
    cp -r ${pkgs.callPackage ../sherpa-onnx { }}/bin/* deps/ 2>/dev/null || true
  '';

  buildPhase = ''
    npm install
    npx node-gyp rebuild
  '';

  installPhase = ''
    mkdir -p $out/lib/sherpa-onnx-node
    cp -r build $out/lib/sherpa-onnx-node/
    cp -r deps $out/lib/sherpa-onnx-node/ 2>/dev/null || true
    
    # Create package.json placeholder
    cat > $out/lib/sherpa-onnx-node/package.json << 'EOF'
{
  "name": "sherpa-onnx-node",
  "version": "${version}",
  "main": "build/Release/sherpa-onnx.node"
}
EOF
  '';

  meta = with lib; {
    description = "Node.js bindings for sherpa-onnx (speech recognition)";
    homepage = "https://github.com/k2-fsa/sherpa-onnx";
    license = licenses.asl20;
    platforms = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
  };
}
