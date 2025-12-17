{
  metadata = {
    hostname = "ikigai";
    system = "x86_64-linux";
  };

  users = [
    {
      username = "halcyon";
      description = "Halcyon";
      isPrimaryUser = true;
      shell = "zsh";
      extraGroups = [
        "networkmanager"
        "wheel"
        "video"
        "render"
        "audio"
        "disk"
        "docker"
        "libvirtd"
        "qemu-libvirtd"
        "wireshark"
      ];
      homeConfig = ../../home/halcyon.nix;
    }
  ];
}
