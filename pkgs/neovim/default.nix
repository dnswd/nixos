{
  pkgs,
  inputs,
  lib,
  ...
}:
inputs.nixvim.legacyPackages.${pkgs.system}.makeNixvimWithModule {
  inherit pkgs;
  extraSpecialArgs = {};
  module = {
    imports = lib.my.importFrom ./config;
  };
}
