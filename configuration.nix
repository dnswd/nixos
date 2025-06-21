# Edit this configuration file to define what should be installed on
# your system.  Help is available in the configuration.nix(5) man page
# and in the NixOS manual (accessible by running ‘nixos-help’).
{ pkgs, ... }:
let
in {
  imports = [
    # Include the results of the hardware scan.
    ./hardware-configuration.nix
  ];

  # Bootloader.
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.hostName = "ikigai"; # Define your hostname.
  # networking.wireless.enable = true;  # Enables wireless support via wpa_supplicant.

  # Configure network proxy if necessary
  # networking.proxy.default = "http://user:password@proxy:port/";
  # networking.proxy.noProxy = "127.0.0.1,localhost,internal.domain";

  # Enable networking
  networking.networkmanager.enable = true;

  # Set your time zone.
  time.timeZone = "Asia/Jakarta";

  # Select internationalisation properties.
  i18n.defaultLocale = "en_US.UTF-8";

  i18n.extraLocaleSettings = {
    LC_ADDRESS = "id_ID.UTF-8";
    LC_IDENTIFICATION = "id_ID.UTF-8";
    LC_MEASUREMENT = "id_ID.UTF-8";
    LC_MONETARY = "id_ID.UTF-8";
    LC_NAME = "id_ID.UTF-8";
    LC_NUMERIC = "id_ID.UTF-8";
    LC_PAPER = "id_ID.UTF-8";
    LC_TELEPHONE = "id_ID.UTF-8";
    LC_TIME = "id_ID.UTF-8";
  };

  # Enable the X11 windowing system.
  services.xserver.enable = true;

  # Use GPU to render X11
  services.xserver.videoDrivers = [ "amdgpu" ];

  # Configure keymap in X11
  services.xserver.xkb = {
    layout = "us";
    variant = "";
  };

  # Enable the GNOME Desktop Environment.
  services.xserver.displayManager.gdm.enable = true;
  services.xserver.desktopManager.gnome.enable = true;

  # Enable Hyperland Desktop Environment
  programs.hyprland = {
    enable = true;
    # set the flake package
    package = pkgs.hyprland.hyprland;
    # make sure to also set the portal package, so that they are in sync
    # portalPackage = pkgs.hyprland.xdg-desktop-portal-hyprland.override {
    #   inherit (pkgs) mesa;
    # };
  };

  # XDG portal needed for hyprland
  xdg.portal = {
    enable = true;
    extraPortals = [ pkgs.xdg-desktop-portal-gtk ];
  };

  # Enable automatic login for the user.
  services.displayManager = {
    autoLogin.enable = true;
    autoLogin.user = "halcyon";
  };

  # Enable CUPS to print documents.
  services.printing.enable = true;

  # Enable sound with pipewire.
  # sound.enable = true;
  services.pulseaudio.enable = false;
  security.rtkit.enable = true;
  services.pipewire = {
    enable = true;
    alsa.enable = true;
    alsa.support32Bit = true;
    pulse.enable = true;
    # If you want to use JACK applications, uncomment this
    #jack.enable = true;

    # use the example session manager (no others are packaged yet so this is enabled by default,
    # no need to redefine it in your config for now)
    #media-session.enable = true;
  };

  # Enable touchpad support (enabled default in most desktopManager).
  # services.xserver.libinput.enable = true;

  # Define a user account. Don't forget to set a password with ‘passwd’.
  users.users.halcyon = {
    isNormalUser = true;
    description = "Halcyon";
    extraGroups = [
      "networkmanager"
      "wheel"
      "video"
      "render"
      "audio"
      "disk"
      "docker"
      "libvirtd"
      "qemu-libvirtd"
      "wireshark"
    ];
    packages = with pkgs; [
      #  thunderbird
    ];
  };

  # Use zsh as default shell
  programs.zsh.enable = true;
  users.defaultUserShell = pkgs.zsh;
  environment = {
    shells = [ pkgs.bashInteractive pkgs.zsh ];
    shellInit = ''
      export GPG_TTY="$(tty)"
    '';
  };

  # Fonts
  fonts = {
    packages = with pkgs; [
      nerd-fonts.fantasque-sans-mono
      # (nerdfonts.override { fonts = [ "FantasqueSansMono" ]; })
    ];
    fontconfig.subpixel.rgba = "rgb";
  };

  # Workaround for GNOME autologin: https://github.com/NixOS/nixpkgs/issues/103746#issuecomment-945091229
  systemd.services."getty@tty1".enable = false;
  systemd.services."autovt@tty1".enable = false;

  # Install firefox.
  programs.firefox.enable = true;

  # Install steam
  programs.steam = {
    enable = true;
    remotePlay.openFirewall = true; # Open ports in the firewall for Steam Remote Play
    dedicatedServer.openFirewall = true; # Open ports in the firewall for Source Dedicated Server
    gamescopeSession.enable = true;
  };

  # Allow unfree packages
  nixpkgs.config.allowUnfree = true;

  nix.settings = {
    show-trace = true;
    # Enable flakes
    experimental-features = [ "nix-command" "flakes" ];
    trusted-users = [ "root" "halcyon" "@wheel" ];

    # TEMPORARY TODO DELETE ME
    # Throttle build bcus it's crashing my pc
    max-jobs = 2;
    cores = 7; # 16 cores, use 7*2=14 cores only
  };

  # Linker (nix-ld)
  programs.nix-ld.enable = true;

  # Enable virtualization
  virtualisation.libvirtd = {
    enable = true;
  };
  virtualisation.docker.enable = true;
  programs.virt-manager.enable = true;

  # List packages installed in system profile. To search, run:
  # $ nix search wget
  environment.systemPackages = with pkgs; [
    bind
    wget
    git
    btop
    coreutils-full
    zip
    unzip
    lsof

    # Dev
    bzip2
    expat
    libffi
    libxcrypt
    ncurses
    openssl
    pkg-config
    readline
    xz
    zlib
    autoconf
    automake
    libtool
    gnumake
    makeWrapper
    patch
    gcc
    binutils

    direnv
    nix-direnv
    python3
    devenv

    # Steam games /w FHS environment
    steam-run

    # Epic Games Store
    (lutris.override {
      extraPkgs = pkgs: [
        # List package dependencies here
        wineWowPackages.stable
        winetricks
      ];
    })

    # Keyboard mapping
    vial

    # Vencord / Discord
    vesktop

    # Slack
    slack

    # Whiteboard
    lorien

    # Helper to execute stuff in FHS environemnt
    (
      let base = pkgs.appimageTools.defaultFhsEnvArgs; in
      pkgs.buildFHSEnv (base // {
        name = "fhs";
        targetPkgs = pkgs:
          # pkgs.buildFHSUserEnv provides only a minimal FHS environment,
          # lacking many basic packages needed by most software.
          # Therefore, we need to add them manually.
          #
          # pkgs.appimageTools provides basic packages required by most software.
          (base.targetPkgs pkgs) ++ (with pkgs; [
            pkg-config
            ncurses
            # Feel free to add more packages here if needed.
          ]
          );
        profile = "export FHS=1";
        runScript = "bash";
        extraOutputsToInstall = [ "dev" ];
      })
    )
  ];

  # udev rule to recognize vial devices and allow them to be configured
  services.udev.extraRules = # udev
    ''
      KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{serial}=="*vial:f64c2b3c*", MODE="0660", GROUP="users", TAG+="uaccess", TAG+="udev-acl"
    '';

  # Some programs need SUID wrappers, can be configured further or are
  # started in user sessions.
  # programs.mtr.enable = true;
  # programs.gnupg.agent = {
  #   enable = true;
  #   enableSSHSupport = true;
  # };

  # List services that you want to enable:

  # Enable the OpenSSH daemon.
  services.openssh.enable = true;
  # Enable fail2ban
  services.fail2ban.enable = true;

  # Open ports in the firewall.
  networking.firewall.enable = true;
  networking.firewall.allowedTCPPorts = [
    51515 # neovim
    53317 # localsend (http)
  ];
  networking.firewall.allowedUDPPorts = [
    53317 # localsend (multicast)
  ];
  # Or disable the firewall altogether.
  # networking.firewall.enable = false;

  # Make sure to route all traffic to wireguard tunnel when enabled
  # https://nixos.wiki/wiki/WireGuard#Setting_up_WireGuard_with_NetworkManager
  networking.firewall.checkReversePath = false;

  # This value determines the NixOS release from which the default
  # settings for stateful data, like file locations and database versions
  # on your system were taken. It‘s perfectly fine and recommended to leave
  # this value at the release version of the first install of this system.
  # Before changing this value read the documentation for this option
  # (e.g. man configuration.nix or on https://nixos.org/nixos/options.html).
  system.stateVersion = "23.11"; # Did you read the comment?
}
