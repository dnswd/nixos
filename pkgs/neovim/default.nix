{ my
, pkgs
, inputs
, system
, osType
, ...
}:

inputs.nixvim.legacyPackages.${system}.makeNixvimWithModule {
  inherit pkgs;
  extraSpecialArgs = { inherit my inputs osType; };
  module = {
    imports = my.importFrom ./config;
  };

}
