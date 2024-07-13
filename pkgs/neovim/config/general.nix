# This file contains plugins that are basics or don't need their own file
{
  my,
  pkgs,
  inputs,
  mkKey,
  ...
}: let

  inherit (my) mkKeymap mkKeymap';
  mkPkgs = name: src: pkgs.vimUtils.buildVimPlugin {inherit name src;};

in {

  viAlias = true;
  vimAlias = true;
  # vimdiffAlias = true;
  # defaultEditor = true;
  
  globals = {
    mapleader = " ";
    maplocalleader = " ";
  };

  opts = {
    signcolumn = "yes";
    tabstop = 4;
    softtabstop = 2;
    shiftwidth = 2;
    updatetime = 300;
    mouse = "a";
  };

  plugins = {
    # Enable lazy loading
    lazy.enable = true;

    # Enable error lens
    trouble.enable = true;
  };

  # Lua helper
  extraPlugins = with pkgs.vimPlugins; [
    plenary-nvim
  ];

}
