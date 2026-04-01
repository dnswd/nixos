{ lib, pkgs, stdenv, nodejs }:

# sherpa-onnx-node with native bindings
stdenv.mkDerivation rec {
  pname = "sherpa-onnx-node";
  version = "1.12.34";

  src = pkgs.fetchurl {
    url = "https://registry.npmjs.org/sherpa-onnx-node/-/sherpa-onnx-node-${version}.tgz";
    hash = "sha256-vxjFf6Rn6lFMS9osl+P2w+xYByv6QLcSKNzj+kVaN8I=";
  };

  nativeBuildInputs = [ nodejs pkgs.cacert ];

  unpackPhase = ''
    tar -xzf $src
  '';

  sourceRoot = "package";

  # Run npm install to download prebuilt binaries
  buildPhase = ''
    export HOME=$TMPDIR
    export npm_config_cache=$TMPDIR/npm-cache
    # Install including optional deps which downloads prebuilds
    npm install --include=optional 2>&1 || true
  '';

  installPhase = ''
    mkdir -p $out/lib/sherpa-onnx-node
    cp -r . $out/lib/sherpa-onnx-node/
  '';

  meta = with lib; {
    description = "Node.js bindings for sherpa-onnx (speech recognition)";
    homepage = "https://github.com/k2-fsa/sherpa-onnx";
    license = licenses.asl20;
    platforms = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
  };
}
