{ lib, pkgs, stdenv, fetchurl, autoPatchelfHook }:

let
  platformInfo = {
    x86_64-linux = {
      system = "linux-x64";
      hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    };
    aarch64-linux = {
      system = "linux-arm64";
      hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    };
    x86_64-darwin = {
      system = "osx-universal2";
      hash = "sha256-9l1lzSvKCSthEPLAhN4EKcqrY/dhB4c21+qF2GqMK6o=";
    };
    aarch64-darwin = {
      system = "osx-universal2";
      hash = "sha256-9l1lzSvKCSthEPLAhN4EKcqrY/dhB4c21+qF2GqMK6o=";
    };
  };

  platform = platformInfo.${stdenv.hostPlatform.system} or (throw "Unsupported platform: ${stdenv.hostPlatform.system}");

in stdenv.mkDerivation rec {
  pname = "sherpa-onnx";
  version = "1.12.34";

  src = fetchurl {
    url = "https://github.com/k2-fsa/sherpa-onnx/releases/download/v${version}/sherpa-onnx-v${version}-onnxruntime-1.15.0-${platform.system}-shared.tar.bz2";
    inherit (platform) hash;
  };

  nativeBuildInputs = lib.optionals stdenv.isLinux [ autoPatchelfHook ];

  buildInputs = lib.optionals stdenv.isLinux (with pkgs; [
    alsa-lib
  ]);

  sourceRoot = ".";

  installPhase = ''
    # Find the extracted directory (contains version in name)
    for dir in sherpa-onnx-*; do
      if [ -d "$dir" ]; then
        mkdir -p $out/bin
        cp -r "$dir/bin/"* $out/bin/ 2>/dev/null || true
        # Also copy libs if they exist
        if [ -d "$dir/lib" ]; then
          mkdir -p $out/lib
          cp -r "$dir/lib/"* $out/lib/ 2>/dev/null || true
        fi
        break
      fi
    done
    chmod +x $out/bin/* 2>/dev/null || true
  '';

  meta = with lib; {
    description = "Speech recognition toolkit using next-gen Kaldi with onnxruntime";
    homepage = "https://github.com/k2-fsa/sherpa-onnx";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
  };
}
