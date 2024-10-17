{
  pkgs,
  ...
}: {

  plugins = {
    tmux-navigator.enable = true;
  };

  extraPlugins = with pkgs.vimPlugins; [
    vim-tmux-clipboard
  ];

}
