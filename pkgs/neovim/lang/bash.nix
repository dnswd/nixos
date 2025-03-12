{ ...
}: {

  plugins = {
    lsp.servers.bashls = {
      enable = true;
      filetypes = [ "sh" "bash" "zsh" ];
    };
  };

}
