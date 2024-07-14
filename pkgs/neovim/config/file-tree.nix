{
  ...
}: {

  plugins.neo-tree = {
    enable = true;
    filesystem.filteredItems = {
      hideDotfiles = false;
      hideGitignored = false;
      visible = true;
    };
  };

}
