{ pkgs, ... }:
let
  pname = "dry";
  version = "0.11.2";
  description = "CLI Docker Management Tool";

  # Note: use `nix store prefetch-file <url>` to get SRI compatible hashes 
  src = pkgs.fetchurl {
    url = "https://github.com/moncho/dry/releases/download/v0.11.2/dry-linux-amd64";
    hash = "sha256-fCE7rG1RoEUOSMnFNYs40VhDEWizLxzkQ+WFUOkPgVc=";
  };
in
pkgs.stdenv.mkDerivation {
  # packing binary
  inherit pname version description src;

  nativeBuildInputs = with pkgs; [ stdenv.cc makeWrapper ];

  # skip unpack because it's not an archive file
  unpackPhase = "true";

  # I can't upgrade docker right now
  installPhase = # sh
    ''
      mkdir -p $out/bin
      install -Dm755 $src $out/bin/dry
      wrapProgram $out/bin/dry --set DOCKER_API_VERSION 1.43
    '';
}

