{ ... }:
{
  plugins.mini.modules = {
    # Simple and easy statusline.
    #  You could remove this setup call if you don't like it,
    #  and try some other statusline plugin
    statusline = {
      use_icons.__raw = "vim.g.have_nerd_font";
    };
  };

  # You can configure sections in the statusline by overriding their
  # default behavior. For example, here we set the section for
  # cursor location to LINE:COLUMN
  # https://nix-community.github.io/nixvim/NeovimOptions/index.html#extraconfiglua
  extraConfigLua = ''
    require('mini.statusline').section_location = function()
      return '%2l:%-2v'
    end
  '';
}
