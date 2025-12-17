{...}: {

  services.mako = {
    enable = true;
    settings = {
      default_timeout = 5000; # 5 seconds
      ignore_timeout = false;
    };
  };

}
