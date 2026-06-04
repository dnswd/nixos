{
  pkgs,
  ...
}:
{
  programs.fzf.tmux.enableShellIntegration = true;
  programs.sesh = {
    enable = true;
    enableAlias = true;
    enableTmuxIntegration = true;
  };
  programs.tmux = {
    enable = true;
    prefix = "C-a"; # use Ctrl+A as prefix
    clock24 = true;
    mouse = true;
    baseIndex = 1;
    shell = "${pkgs.zsh}/bin/zsh";
    sensibleOnTop = true;
    terminal = "screen-256color";
    extraConfig = # tmux
      ''
        # terminal settings
        set-option -g renumber-windows on
        set-option -sa terminal-overrides ",xterm*:Tc" # use 24 color when terminal support it
        set-option -gw xterm-keys on # enable xterm keys

        # better copy mode (vi)
        bind [ copy-mode # prefix + [ to enter copy mode
        set-window-option -g mode-keys vi # set vi-mode
        bind-key -T copy-mode-vi v   send-keys -X begin-selection # start selection
        bind-key -T copy-mode-vi C-v send-keys -X rectangle-toggle # toggle line/block select
        bind-key -T copy-mode-vi y   send-keys -X copy-selection-and-cancel # yank
        bind / copy-mode \; send-keys ? # search

        # pane splits
        bind v split-window -h -c "#{pane_current_path}"
        bind s split-window -v -c "#{pane_current_path}"

        # pane navigation
        bind h select-pane -L
        bind j select-pane -D
        bind k select-pane -U
        bind l select-pane -R

        # pane resize (repeatable)
        bind -r H resize-pane -L 3
        bind -r J resize-pane -D 3
        bind -r K resize-pane -U 3
        bind -r L resize-pane -R 3

        # panel ops
        bind z resize-pane -Z # zoom pane
        bind p confirm-before -p "Kill pane #P? (y/n)" kill-pane

        # window management
        bind c new-window
        bind w confirm-before -p "Kill window #W? (y/n)" kill-window
        bind n next-window
        bind N previous-window
        bind Tab last-window

        # session manageent
        ## Handled by sesh's tmux integration, use `prefix+s` to open
      '';

    plugins = with pkgs; [
      tmuxPlugins.vim-tmux-navigator
      tmuxPlugins.yank
    ];
  };
}
