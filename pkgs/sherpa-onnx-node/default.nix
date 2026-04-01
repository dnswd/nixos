{ lib, pkgs, stdenv }:

# sherpa-onnx-node npm package with pre-built binaries
stdenv.mkDerivation rec {
  pname = "sherpa-onnx-node";
  version = "1.12.34";

  src = pkgs.fetchurl {
    url = "https://registry.npmjs.org/sherpa-onnx-node/-/sherpa-onnx-node-${version}.tgz";
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  sourceRoot = "package";

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
