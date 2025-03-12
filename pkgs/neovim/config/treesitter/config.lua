do
    -- register .zsh script to use bash, since TS doesn't support zsh yet
    -- context: https://github.com/nvim-treesitter/nvim-treesitter/issues/655
    require("nvim-treesitter.parsers").filetype_to_parsername.zsh = "bash"
end
