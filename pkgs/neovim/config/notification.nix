{
  ...
}:
let
  inherit (my) mkKeymap; 
in {

  plugins.notify = {
    enable = true;
  };

  keymaps = [
    (mkKeymap "n" "<Leader>nd" '':lua require("notify").dismiss()'' "Dismiss all notification")
    (mkKeymap "n" "<Leader>nh" '':Telescope notify''                "Open notification history")
  ];

}
