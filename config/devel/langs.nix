{ config, pkgs, ... }: {
  # some pl packages are handy for quickly trying something out etc.
  home.packages =
    with pkgs; [
      # JS / TypeScript
      nodejs_latest

      # Nix
      nixd
      nixpkgs-fmt
      nixpkgs-lint

      # Python
      python3
    ];

  # JDK Setup (https://whichjdk.com/)
  programs.java = { enable = true; package = pkgs.zulu17; };

  home.sessionPath = [ "${config.home.homeDirectory}/.jdks" ];
  # Kudos to @TLATER https://discourse.nixos.org/t/nix-language-question-linking-a-list-of-packages-to-home-files/38520
  home.file = (builtins.listToAttrs (builtins.map
    (jdk: {
      name = ".jdks/jdk-${builtins.elemAt (builtins.splitVersion jdk.version) 0}";
      value = { source = jdk; };
    })
    (with pkgs; [ zulu17 ])));
}
