{ ...
}: {

  plugins = {
    lsp.servers.nixd = {
      enable = true;
      settings = {
        formatting.command = [ "nixpkgs-fmt" ];
      };
      extraOptions = {
        offset_encoding = "utf-8"; # https://github.com/nix-community/nixvim/issues/2390#issuecomment-2408101568
      };
    };
  };

}
