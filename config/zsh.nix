{
  pkgs,
  lib,
  ...
}: {
  programs.zsh = {
    enable = true;
    defaultKeymap = "viins";
    dotDir = ".config/zsh";
    # initExtraFirst = builtins.readFile ~/.config/zsh/initExtraFirst.zsh;

    # Quality of life
    autocd = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;
    historySubstringSearch.enable = true;
    history = {
      ignoreDups = true;
      ignoreSpace = true;
      path = "$ZDOTDIR/.history";
      share = true;
    };

    envExtra = builtins.concatStringsSep "\n" [
      "ZSH_TMUX_AUTOSTART=true" # Autostart tmux
    ];

    shellAliases = {
      # use zoxide by default
      cd = "z";
    };

    initExtra =
      /*
      Bash
      */
      ''
        # Case insensitive completion
        zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

        # Completion colors based on 'ls --color'
        zstyle ':completion:*' list-colors ''${(s.:.)LS_COLORS}

        # Disable default completion menu to be replaced with fzf
        zstyle ':completion:*' menu no
        zstyle '"fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
        zstyle '"fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

        # Autostart tmux
        if [ -x "$(command -v tmux)" ] && [ -n "''${DISPLAY}" ] && [ -z "''${TMUX}" ]; then
            exec tmux new-session -A -s ''${USER} >/dev/null 2>&1
        fi
      '';

    plugins = [
      {
        name = "zsh-fzf-tab";
        file = "fzf-tab.plugin.zsh";
        src = "${pkgs.zsh-fzf-tab}/share/fzf-tab";
      }
    ];
  };
}
