{
  my,
  pkgs,
  inputs,
  system,
  ...
}:
inputs.nixvim.legacyPackages.${system}.makeNixvimWithModule {
  inherit pkgs;
  extraSpecialArgs = {inherit my inputs;};
  module = {
    imports = my.importFrom ./config;
  };
}
