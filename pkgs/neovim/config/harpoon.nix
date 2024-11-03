{ my, ... }:
let
  inherit (my) mkLuaKeymap;
in
{
  plugins.harpoon = {
    enable = true;
  };

  keymaps = [
    (mkLuaKeymap "n" "<leader>qa" /* lua */ ''require("harpoon.mark").add_file'' "Add file to harpoon")
    (mkLuaKeymap "n" "<leader>qq"     /* lua */ ''require("harpoon.ui").toggle_quick_menu'' "Toggle harpoon menu")
    # File maps
    (mkLuaKeymap "n" "<C-j>"     /* lua */ ''function() require("harpoon.ui").nav_file(1) end'' "Navigate to harpooned file")
    (mkLuaKeymap "n" "<C-k>"     /* lua */ ''function() require("harpoon.ui").nav_file(2) end'' "Navigate to harpooned file")
    (mkLuaKeymap "n" "<C-l>"     /* lua */ ''function() require("harpoon.ui").nav_file(3) end'' "Navigate to harpooned file")
    (mkLuaKeymap "n" "<C-;>"     /* lua */ ''function() require("harpoon.ui").nav_file(4) end'' "Navigate to harpooned file")
  ];
}
