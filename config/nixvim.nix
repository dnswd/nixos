{ pkgs, ... }: {
  home.packages = [ pkgs.my.neovim ];

  # Java runtime for nixvim jdtls (java LSP)
  programs.java = {
    enable = true;
    # package = pkgs.jdk17;
  };
}
