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
    (mkKeymap "n" "<Tab>" ":BufferLineCycleNext<CR>" "Cycle to next tab")
    (mkKeymap "n" "<S-Tab>" ":BufferLineCyclePrev<CR>" "Cycle to previous tab")
    (mkKeymap "n" "<C-w>" ":bd<CR>" "Close current tab")
  ];

}
