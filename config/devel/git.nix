{ pkgs
, lib
, ...
}: {
  programs.git = {
    enable = true;
    settings = {
      user = {
        name = "Dennis Al Baihaqi Walangadi";
        email = "dennis.walangadi@gmail.com";
      };

      alias = {
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
        psf = "push --force-with-lease";
        # mt = "mergetool"; # fire up the merge tool

        # rebase
        rc = "rebase --continue"; # continue rebase
        rs = "rebase --skip"; # skip rebase

        # remote
        r = "remote -v"; # show remotes (verbose)

        # MONOREPO: incomplete clone aliases
        clone-only-recent = "clone --filter=blob:none";
        clone-only-files = "clone --filter=tree:0";
      };

      # git to leverage column view up to terminal width
      column.ui = "auto";

      # show recently worked branches
      branch.sort = "-committerdate";


      extraConfig = {
        core = {
          editor = "nvim";
          autocrlf = "input";
          pager = "${pkgs.lib.getExe pkgs.diff-so-fancy} | less --tabs=4 -RFX";
          fsmonitor = true; # MONOREPO: efficient changes detection
        };

        # Force SSH on GitHub
        # url = {
        #   "git@github.com:" = { insteadOf = "https://github.com/"; };
        # };
        "url \"git@github.com:\"".insteadOf = "https://github.com/";

        # Fetch strats
        fetch = {
          # MONOREPO: Prebuild log graph during fetch/prefetch
          writeCommitGraph = true;
        };

        # Pull request stuffs
        pull = {
          ff = "only";
          rebase = false;
        };

        # enable rerere
        rerere.enabled = true;

        # Auto-set upstream branch
        push = {
          autoSetupRemote = true;
        };

        # Pretty diff
        diff.algorithm = "histogram";

        # Disable safedir, only do this if you're the sole user of the machine
        safe.directory = "*";
      };
    };
  };

  # Enable 'delta' git diff viewer
  programs.delta = {
    enable = true;
    enableGitIntegration = true;
  };

  home.packages = with pkgs; [
    # git-stack helps with viewing your PR's parent commit for rebasing PRs
    # e.g. If you want to move the parent of your PR from A to B
    # you can do "git rebase A --onto B"
    git-stack
  ];
}
