{ pkgs, lib, ... }: {
  plugins.codeium-nvim = {
    enable = true;
    settings = {
      enable_chat = true;
      virtual_text.enabled = true;
      tools = {
        curl = lib.getExe pkgs.curl;
        gzip = lib.getExe pkgs.gzip;
        uname = lib.getExe' pkgs.coreutils "uname";
        uuidgen = lib.getExe' pkgs.util-linux "uuidgen";
      };
    };
  };
}
