{ my, ... }:
let
  inherit (my) mkKeymap;
in
{
  plugins.undotree = {
    enable = true;
  };

  keymaps = [
    (mkKeymap "n" "<leader>u" /* lua */ ''UndotreeToggle'' "Toggle undotree sidebar")
  ];
}
