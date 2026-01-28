{ my
, ...
}:
let
  inherit (my) mkLuaKeymap;
in
{
  plugins.telescope = {
    enable = true;
  };

  keymaps = [
    (mkLuaKeymap "n" "<leader>pf" /* lua */ ''require("telescope.builtin").find_files'' "Find files")
    (mkLuaKeymap "n" "<leader>pg" /* lua */ ''require("telescope.builtin").git_files'' "Find git files")
    (mkLuaKeymap "n" "<leader>ps" /* lua */
      ''
        function()
          require("telescope.builtin").grep_string({ search = vim.fn.input("Grep> ") })
        end
      '' "Find files")
  ];

}
