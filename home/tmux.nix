
{
  pkgs,
  lib,
  ...
}: {
  programs.tmux = {
    enable = true;
    catppuccin.enable = true;
    prefix = "C-Space"; # use Ctrl+Space as prefix
    clock24 = true;
    mouse = true;
    baseIndex = 1;
    shell = "${pkgs.zsh}/bin/zsh";
    sensibleOnTop = true;
    terminal = "screen-256color";
    extraConfig = /* sh */ ''
      set-option -g renumber-windows on

      # Fix tmux color (use 24 color when terminal support it)
      set-option -sa terminal-overrides ",xterm*:Tc"

      # Better copy flow (vi)
      set-window-option -g mode-keys vi # set vi-mode
      bind-key -T copy-mode-vi v send-keys -X begin-selection # start selection
      bind-key -T copy-mode-vi C-v send-keys -X rectangle-toggle # toggle line/block select
      bind-key -T copy-mode-vi y send-keys -X copy-selection-and-cancel # yank

      # List sessions
      bind-key -T prefix l choose-tree -Zs

      # Allow xterm keys, for tab-like controls
      set-option -gw xterm-keys on

      # Shift+Alt+H/L to switch windows
      bind -n M-H previous-window
      bind -n M-L next-window

      # Chrome tab-like window switching
      bind -n M-T new-window
      bind -n M-W confirm-before -p "kill-window #W? (y/n)" kill-window

      # Open panes in cwd
      bind -n M-'\' split-window -h -c "#{pane_current_path}"
      bind -n M-'-' split-window -v -c "#{pane_current_path}"
      bind -n M-P confirm-before -p "kill-pane #P? (y/n)" kill-pane

      # Expand pane
      bind -n M-z resize-pane -Z

      # Select pane with Alt+vi
      bind -n M-k select-pane -U
      bind -n M-j select-pane -D
      bind -n M-h select-pane -L
      bind -n M-l select-pane -R

      # Enter copy mode
    '';

    plugins = with pkgs; [
      tmuxPlugins.vim-tmux-navigator
      tmuxPlugins.yank
    ];
  };
}