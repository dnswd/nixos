{
  my,
  pkgs,
  inputs,
  mkKey,
  ...
}: {

  clipboard = {
    register = "unnamedplus";
    providers = {
      wl-copy.enable = true;
      xclip = true;
    };
  };
  
}