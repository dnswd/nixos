{ my, ... }:
let
  inherit (my) mkKeymap;
in
{
  keymaps = [
    (mkKeymap "n" "<leader>v" ":NvimTreeToggle<CR>" "Open nvim-tree.lua")

    (mkKeymap "v" "J" ":m '>+1<CR>gv=gv" "Move selected lines upwards")
    (mkKeymap "v" "K" ":m '<-2<CR>gv=gv" "Move selected lines downwards")

    (mkKeymap "n" "J" "mzJ`z" "Prepend this line with the line below")

    # avoiding fatigue/disorientation
    (mkKeymap "n" "<C-d>" "<C-d>zz" "Page down but cursor stay in the middle")
    (mkKeymap "n" "<C-u>" "<C-u>zz" "Page up but cursor stay in the middle")
    (mkKeymap "n" "n" "nzzzv" "Next search but cursor stay in the middle")
    (mkKeymap "n" "N" "Nzzzv" "Previous search but cursor stay in the middle")

    # Make sure keep the register when pasting (default behavior: replaced with deleted content when pasting)
    (mkKeymap "x" "<leader>p" ''"_dP'' "Paste without replacing the register content")

    # Make sure delete doesn't store content to registe
    (mkKeymap "n" "<leader>d" ''"_d'' "Delete to void")
    (mkKeymap "v" "<leader>d" ''"_d'' "Delete to void")

    # Yank to system register 
    (mkKeymap "n" "<leader>y" ''"+y'' "Yank to system clipboard")
    (mkKeymap "v" "<leader>y" ''"+y'' "Yank to system clipboard")
    (mkKeymap "n" "<leader>Y" ''"+Y'' "Yank to system clipboard")

    # Don't accidentally run a macro
    (mkKeymap "n" "Q" "<nop>" "Do nothing")

    # Quick fix
    (mkKeymap "n" "<C-k>" "<cmd>cnext<CR>zz" "Go to next error in quickfix list")
    (mkKeymap "n" "<C-j>" "<cmd>cprev<CR>zz" "Go to previous error in quickfix list")
    (mkKeymap "n" "<leader>k" "<cmd>lnext<CR>zz" "Go to next error")
    (mkKeymap "n" "<leader>j" "<cmd>lprev<CR>zz" "Go to previous error")

    # Helper to substitute current word
    (mkKeymap "n" "<leader>s" '':%s/\<<C-r><C-w>\>/<C-r><C-w>/gI<Left><Left><Left>'' "Substitute current word")

    # CLI shenanigans
    # sessionizer doesn't work yet 
    (mkKeymap "n" "<C-f>" "<cmd>silent !tmux neww tmux-sessionizer<CR>" "Create new tmux session")
    (mkKeymap "n" "<leader>x" "<cmd>!chmod +x %<CR>" "Make current file executable")
  ];
}
