{ lib, pkgs, buildPythonPackage, cffi, requests, tqdm, websockets, srt }:

let
  inherit (pkgs) stdenv;

  # Vosk 0.3.44 is the last version with macOS wheels (universal2)
  platformInfo = {
    x86_64-linux = {
      name = "manylinux_2_12_x86_64.manylinux2010_x86_64";
      hash = "sha256-dD0D2XyFeD1lK9N2Kb4gZWi8cMdeZS2APwkQ3D1QEyg=";
    };
    aarch64-linux = {
      name = "manylinux2014_aarch64";
      hash = "sha256-VlEo2dVNzpVT5CZ63Qn49GfUKNzqtEJn8tM0gP1HN0s=";
    };
    # macOS uses universal2 wheel for both x86_64 and arm64
    x86_64-darwin = {
      name = "macosx_10_6_universal2";
      hash = "sha256-Ap0LPWpc/4dMV1uKWBSkzM+zdgjP9S6EbAKoxnqIKAE=";
    };
    aarch64-darwin = {
      name = "macosx_10_6_universal2";
      hash = "sha256-Ap0LPWpc/4dMV1uKWBSkzM+zdgjP9S6EbAKoxnqIKAE=";
    };
  };

  platform = platformInfo.${stdenv.hostPlatform.system} or (throw "Unsupported platform: ${stdenv.hostPlatform.system}");

in buildPythonPackage rec {
  pname = "vosk";
  version = "0.3.44";
  format = "wheel";

  src = pkgs.fetchurl {
    url = "https://files.pythonhosted.org/packages/py3/v/vosk/vosk-${version}-py3-none-${platform.name}.whl";
    inherit (platform) hash;
  };

  propagatedBuildInputs = [
    cffi
    requests
    tqdm
    websockets
    srt
  ];

  pythonImportsCheck = [ "vosk" ];

  meta = with lib; {
    description = "Offline speech recognition API";
    homepage = "https://github.com/alphacep/vosk-api";
    license = licenses.asl20;
    platforms = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
  };
}
