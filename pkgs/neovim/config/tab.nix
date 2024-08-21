{
  my,
  ...
}: let
  inherit (my) mkKeymap; 
in{

  plugins.bufferline = {
    enable = true;
  };
  
  keymaps = [
    (mkKeymap "n" "<C-w>" ":bd<CR>" "Close current tab")
  ];

}
