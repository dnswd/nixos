{ ... }: {
  plugins.lsp.servers.tinymist = {
    enable = true;
    extraOptions = {
      offset_encoding = "utf-8";
    };
  };
}
