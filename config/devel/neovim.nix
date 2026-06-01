{ pkgs, inputs, ... }:
{
  home.packages = [ inputs.halcyon-vim.packages.${pkgs.system}.default ];
}
