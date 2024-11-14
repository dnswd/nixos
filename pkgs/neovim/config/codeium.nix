{ pkgs, lib, ... }: {
  plugins.codeium-nvim = {
    enable = true; # TODO fix cmp issue
    settings = {
      enable_cmp_source = true;
      enable_chat = true;
      # virtual_text = {
      #   enabled = true;
      #   key_bindings.accept = false; # handled by nvim-cmp
      # };
      tools = {
        curl = lib.getExe pkgs.curl;
        gzip = lib.getExe pkgs.gzip;
        uname = lib.getExe' pkgs.coreutils "uname";
        uuidgen = lib.getExe' pkgs.util-linux "uuidgen";
      };
    };
  };

  keymaps = [
    {
      mode = "n";
      key = "<leader>C";
      action = ":Codeium Chat<CR>";
      options = {
        silent = true;
        desc = "Open codeium chat";
      };
    }
  ];
}
