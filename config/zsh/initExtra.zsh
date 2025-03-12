# Case insensitive completion
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

# Completion colors based on 'ls --color'
zstyle ':completion:*' list-colors ''${(s.:.)LS_COLORS}

# Disable default completion menu to be replaced with fzf
zstyle ':completion:*' menu no
zstyle '"fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle '"fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

if [ "$TERMINAL_EMULATOR" != "JetBrains-JediTerm"]; then 
   ZSH_TMUX_AUTOSTART=true
fi

# Autostart tmux on fresh terminal
if [ -x "$(command -v tmux)" ] && [ -n "''${DISPLAY}" ] && [ -z "''${TMUX}" ]; then
    exec tmux new-session -A -s ''${USER} >/dev/null 2>&1
fi
