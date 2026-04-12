{
  pkgs,
  lib,
  config,
  ...
}:
{
  imports = [ ../secrets.nix ];

  home.packages = with pkgs; [ git-stack lazygit gh ];

  programs.git = {
    enable = true;
    settings = {
      alias = {
        c = "commit"; cm = "commit -m"; ca = "commit -am";
        amend = "commit --amend"; append = "commit --amend --no-edit";
        recent-branches = "!git for-each-ref --count=5 --sort=-committerdate refs/heads/ --format='%(refname:short)'";
        nb = "checkout -b"; sw = "switch"; pl = "pull"; ps = "push"; psf = "push --force-with-lease";
        rc = "rebase --continue"; rs = "rebase --skip";
        r = "remote -v";
        clone-only-recent = "clone --filter=blob:none";
        clone-only-files = "clone --filter=tree:0";
      };
      column.ui = "auto";
      branch.sort = "-committerdate";
      include.path = "${config.home.homeDirectory}/.config/git/config.secret";
      extraConfig = {
        core = {
          editor = "nvim";
          autocrlf = "input";
          pager = "${pkgs.lib.getExe pkgs.diff-so-fancy} | less --tabs=4 -RFX";
          fsmonitor = true;
        };
        "url \"git@github.com:\"".insteadOf = "https://github.com/";
        fetch.writeCommitGraph = true;
        pull = { ff = "only"; rebase = false; };
        rerere.enabled = true;
        push.autoSetupRemote = true;
        diff.algorithm = "histogram";
        safe.directory = "*";
      };
    };
  };

  programs.delta = {
    enable = true;
    enableGitIntegration = true;
  };
}
