{ pkgs, ... }:
{
  programs.obsidian = {
    enable = true;
    cli.enable = true;

    # vaults
    vaults."tiaoli" = {
      enable = true;
      target = "Documents/vaults/tiaoli";
    };

    defaultSettings = {
      # settings
      app = {
        showLineNumber = true;
        showInlineTitle = false;
        confirmFileDeletion = false;
        deletedFiles = "trash";
        spellcheck = true;
        spellcheckLanguages = [
          "en-US"
          "id-ID"
        ];
      };

      # themes
      themes = [ pkgs.obsidianThemes.minimal ];

      # plugins
      corePlugins = [
        "audio-recorder"
        "backlink"
        "bases"
        "bookmarks"
        "canvas"
        "command-palette"
        "daily-notes"
        "editor-status"
        "file-explorer"
        "file-recovery"
        "footnotes"
        "global-search"
        "graph"
        "markdown-importer"
        "note-composer"
        "outgoing-link"
        "outline"
        "page-preview"
        "properties"
        "publish"
        "random-note"
        "slash-command"
        "slides"
        "switcher"
        "sync"
        "tag-pane"
        "templates"
        "webviewer"
        "word-count"
        "workspaces"
        "zk-prefixer"
      ];

      communityPlugins = with pkgs.obsidianPlugins; [
        bases-relation-diagram
        bloomscroll
        goko
        heatmap-tracker
        key-promoter
        mermaid-tools
        micropatches
        more-excellent-hotkeys
        obsidian-focus-mode
        obsidian-excalidraw-plugin
        vault-full-statistics
      ];

    };
  };
}
