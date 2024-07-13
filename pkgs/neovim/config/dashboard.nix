{
  my,
  pkgs,
  inputs,
  mkKey,
  ...
}: let

  inherit (my) mkKeymap mkKeymap';
  mkPkgs = name: src: pkgs.vimUtils.buildVimPlugin {inherit name src;};

in {

  plugins.dashboard = {
    enable = true;
    settings = {
      config = {
        packages = { enable = false; };
        week_header.enable = true;
        footer = [" " " " "Don't Stop Until You are Proud..."];
        project = { enable = false; };
        header = [
          ""
          "           zzz"
          "　　　_,,..,,,,_ . ＿"
          "　　./ ,' 3 ／ 　 ヽ--、"
          "　　l　　 / 　　　　　 　ヽ、"
          " ／`'ｰ/＿＿＿＿＿／"
          " ￣￣￣￣￣￣￣￣ "
          ""
        ];
        shortcut = [
          {
            desc = "${icons.ui.BoldClose} Quit";
            group = "DiagnosticError";
            key = "q";
            action = "qa";
          }
        ];
      }
    };
  };

}
