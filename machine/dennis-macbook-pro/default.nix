{
  metadata = {
    hostname = "Dennis-MacBook-Pro";
    system = "aarch64-darwin";
    osType = "darwin";
  };

  users = [
    {
      username = "oydennisalbaihaqi";
      description = "Dennis";
      isPrimaryUser = true;
      shell = "zsh";
      extraGroups = [];
      homeConfig = ../../home/dennis.nix;
    }
  ];
}
