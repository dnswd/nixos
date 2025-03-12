{ pkgs
, lib
, ...
}: {
  programs.git = {
    enable = true;
    userName = "Dennis Al Baihaqi Walangadi";
    userEmail = "dennis.walangadi@gmail.com";
    aliases = {
      # commit
      c = "commit"; # commit
      cm = "commit -m"; # commit with message
      ca = "commit -am"; # commit all with message
      amend = "commit --amend"; # ammend your last commit
      append = "commit --amend --no-edit"; # append changes into your last commit

      # branch
      recent-branches = "!git for-each-ref --count=5 --sort=-committerdate refs/heads/ --format='%(refname:short)'";
      nb = "checkout -b";
      sw = "switch";
      pl = "pull";
      ps = "push";
      # mt = "mergetool"; # fire up the merge tool

      # rebase
      rc = "rebase --continue"; # continue rebase
      rs = "rebase --skip"; # skip rebase

      # remote
      r = "remote -v"; # show remotes (verbose)
    };

    extraConfig = {
      core = {
        editor = "nvim";
        autocrlf = "input";
      };

      # Force SSH on GitHub
      url."git@github.com:".insteadOf = "https://github.com/";

      # Pull request stuffs
      pull = {
        ff = "only";
        rebase = false;
      };

      # Auto-set upstream branch
      push = {
        autoSetupRemote = true;
      };

      # Pretty diff
      diff.algorithm = "histogram";

      # Disable safedir, only do this if you're the sole user of the machine
      safe.directory = "*";
    };

    # Enable 'delta' git diff viewer
    delta = {
      enable = true;
    };
  };

  home.packages = with pkgs; [
    # git-stack helps with viewing your PR's parent commit for rebasing PRs
    # e.g. If you want to move the parent of your PR from A to B
    # you can do "git rebase A --onto B"
    git-stack
  ];
}
