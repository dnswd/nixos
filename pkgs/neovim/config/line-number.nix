{
  ...
}: {

  opts = {
    number = true;
  };

  autoCmd = [
    {
      desc = "Disable relative number when entering Insert mode";
      event = "InsertEnter";
      pattern = "*";
      callback = {
        __raw = /* lua */ ''
          function()
              vim.opt.relativenumber = false
          end
        '';
      };
    }
    {
      desc = "Enable relative number when leaving Insert mode";
      event = [ "InsertLeave" "BufEnter" ];
      pattern = "*";
      callback = {
        __raw = /* lua */ ''
          function()
              vim.opt.relativenumber = true
          end
        '';
      };
    }
  ];

}
