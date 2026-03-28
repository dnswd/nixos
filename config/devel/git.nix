{
  pkgs,
  lib,
  config,
  ...
}:
{
  imports = [ ../../secrets/agenix-home.nix ];

  programs.git = {
    enable = true;
    settings = {
      alias = {
        # commit
        c = "commit";
        cm = "commit -m";
        ca = "commit -am";
        amend = "commit --amend";
        append = "commit --amend --no-edit";

        # branch
        recent-branches = "!git for-each-ref --count=5 --sort=-committerdate refs/heads/ --format='%(refname:short)'";
        nb = "checkout -b";
        sw = "switch";
        pl = "pull";
        ps = "push";
        psf = "push --force-with-lease";

        # rebase
        rc = "rebase --continue";
        rs = "rebase --skip";

        # remote
        r = "remote -v";

        # MONOREPO: incomplete clone aliases
        clone-only-recent = "clone --filter=blob:none";
        clone-only-files = "clone --filter=tree:0";
      };

      column.ui = "auto";
      branch.sort = "-committerdate";

      include = {
        path = config.age.secrets.gitconfig.path;
      };

      extraConfig = {
        core = {
          editor = "nvim";
          autocrlf = "input";
          pager = "${pkgs.lib.getExe pkgs.diff-so-fancy} | less --tabs=4 -RFX";
          fsmonitor = true;
        };

        "url \"git@github.com:\"".insteadOf = "https://github.com/";

        fetch = {
          writeCommitGraph = true;
        };

        pull = {
          ff = "only";
          rebase = false;
        };

        rerere.enabled = true;

        push = {
          autoSetupRemote = true;
        };

        diff.algorithm = "histogram";

        safe.directory = "*";
      };
    };
  };

  programs.delta = {
    enable = true;
    enableGitIntegration = true;
  };

  home.packages = with pkgs; [
    git-stack
  ];
}
