# Do not modify this file!  It was generated by ‘nixos-generate-config’
# and may be overwritten by future invocations.  Please make changes
# to /etc/nixos/configuration.nix instead.
{
  config,
  lib,
  pkgs,
  modulesPath,
  ...
}: let
  vfioStartupScript = pkgs.writeShellScriptBin "vfio-startup" ''
    set -x

    DATE=$(date +"%m/%d/%Y %R:%S :")
    DISPMGR="null"
    echo "$DATE Beginning of Startup!"

    function stop_display_manager_if_running {
      if [[ -x /run/systemd/system ]] && echo "$DATE Distro is using Systemd"; then
        DISPMGR="$(grep 'ExecStart=' /etc/systemd/system/display-manager.service | awk -F'/' '{print $(NF-0)}')"
        echo "$DATE Display Manager = $DISPMGR"
        if systemctl is-active --quiet "$DISPMGR.service"; then
          grep -qsF "$DISPMGR" "/tmp/vfio-store-display-manager" || echo "$DISPMGR" >/tmp/vfio-store-display-manager
          systemctl stop "$DISPMGR.service"
          systemctl isolate multi-user.target
        fi
        while systemctl is-active --quiet "$DISPMGR.service"; do
          sleep "1"
        done
        return
      fi
    }

    function kde-clause {
      echo "$DATE Display Manager = display-manager"
      if systemctl is-active --quiet "display-manager.service"; then
        grep -qsF "display-manager" "/tmp/vfio-store-display-manager"  || echo "display-manager" >/tmp/vfio-store-display-manager
        systemctl stop "display-manager.service"
      fi
      while systemctl is-active --quiet "display-manager.service"; do
        sleep 2
      done
      return
    }

    if pgrep -l "plasma" | grep "plasmashell"; then
      echo "$DATE Display Manager is KDE, running KDE clause!"
      kde-clause
    else
      echo "$DATE Display Manager is not KDE!"
      stop_display_manager_if_running
    fi

    if test -e "/tmp/vfio-is-nvidia"; then
      rm -f /tmp/vfio-is-nvidia
    else
      test -e "/tmp/vfio-is-amd"
      rm -f /tmp/vfio-is-amd
    fi

    sleep "1"

    if test -e "/tmp/vfio-bound-consoles"; then
      rm -f /tmp/vfio-bound-consoles
    fi
    for (( i = 0; i < 16; i++))
    do
      if test -x /sys/class/vtconsole/vtcon"''${i}"; then
        if [ "''$(grep -c "frame buffer" /sys/class/vtconsole/vtcon"''${i}"/name)" = 1 ]; then
          echo 0 > /sys/class/vtconsole/vtcon"''${i}"/bind
          echo "$DATE Unbinding Console ''${i}"
          echo "$i" >> /tmp/vfio-bound-consoles
        fi
      fi
    done

    sleep "1"

    if lspci -nn | grep -e VGA | grep -s NVIDIA ; then
      echo "$DATE System has an NVIDIA GPU"
      grep -qsF "true" "/tmp/vfio-is-nvidia" || echo "true" >/tmp/vfio-is-nvidia
      echo efi-framebuffer.0 > /sys/bus/platform/drivers/efi-framebuffer/unbind
      modprobe -r nvidia_uvm
      modprobe -r nvidia_drm
      modprobe -r nvidia_modeset
      modprobe -r nvidia
      modprobe -r i2c_nvidia_gpu
      modprobe -r drm_kms_helper
      modprobe -r drm
      echo "$DATE NVIDIA GPU Drivers Unloaded"
    fi

    if lspci -nn | grep -e VGA | grep -s AMD ; then
      echo "$DATE System has an AMD GPU"
      grep -qsF "true" "/tmp/vfio-is-amd" || echo "true" >/tmp/vfio-is-amd
      echo efi-framebuffer.0 > /sys/bus/platform/drivers/efi-framebuffer/unbind
      modprobe -r drm_kms_helper
      modprobe -r amdgpu
      modprobe -r radeon
      modprobe -r drm
      echo "$DATE AMD GPU Drivers Unloaded"
    fi

    modprobe vfio
    modprobe vfio_pci
    modprobe vfio_iommu_type1
    echo "$DATE End of Startup!"
  '';

  vfioTeardownScript = pkgs.writeShellScriptBin "vfio-teardown" ''
    set -x

    DATE=$(date +"%m/%d/%Y %R:%S :")
    echo "$DATE Beginning of Teardown!"

    modprobe -r vfio_pci
    modprobe -r vfio_iommu_type1
    modprobe -r vfio

    if grep -q "true" "/tmp/vfio-is-nvidia" ; then
      echo "$DATE Loading NVIDIA GPU Drivers"
      modprobe drm
      modprobe drm_kms_helper
      modprobe i2c_nvidia_gpu
      modprobe nvidia
      modprobe nvidia_modeset
      modprobe nvidia_drm
      modprobe nvidia_uvm
      echo "$DATE NVIDIA GPU Drivers Loaded"
    fi

    if grep -q "true" "/tmp/vfio-is-amd" ; then
      echo "$DATE Loading AMD GPU Drivers"
      modprobe drm
      modprobe amdgpu
      modprobe radeon
      modprobe drm_kms_helper
      echo "$DATE AMD GPU Drivers Loaded"
    fi

    input="/tmp/vfio-store-display-manager"
    while read -r DISPMGR; do
      if command -v systemctl; then
        echo "$DATE Var has been collected from file: $DISPMGR"
        systemctl start "$DISPMGR.service"
      else
        if command -v sv; then
          sv start "$DISPMGR"
        fi
      fi
    done < "$input"

    input="/tmp/vfio-bound-consoles"
    while read -r consoleNumber; do
      if test -x /sys/class/vtconsole/vtcon"''${consoleNumber}"; then
        if [ "''$(grep -c "frame buffer" "/sys/class/vtconsole/vtcon''${consoleNumber}/name")" = 1 ]; then
          echo "$DATE Rebinding console ''${consoleNumber}"
          echo 1 > /sys/class/vtconsole/vtcon"''${consoleNumber}"/bind
        fi
      fi
    done < "$input"

    echo "$DATE End of Teardown!"
  '';

  customHookScript = pkgs.writeShellScriptBin "qemuHook" ''
    OBJECT="$1"
    OPERATION="$2"

    if [[ $OBJECT == "win10" ]]; then
      case "$OPERATION" in
        "prepare")
          ${pkgs.systemd}/bin/systemctl start libvirt-nosleep@"$OBJECT" 2>&1 | ${pkgs.coreutils}/bin/tee -a /var/log/libvirt/custom_hooks.log
          ${vfioStartupScript} 2>&1 | ${pkgs.coreutils}/bin/tee -a /var/log/libvirt/custom_hooks.log
          ;;

        "release")
          ${pkgs.systemd}/bin/systemctl stop libvirt-nosleep@"$OBJECT" 2>&1 | ${pkgs.coreutils}/bin/tee -a /var/log/libvirt/custom_hooks.log
          ${vfioTeardownScript} 2>&1 | ${pkgs.coreutils}/bin/tee -a /var/log/libvirt/custom_hooks.log
          ;;
      esac
    fi
  '';
in {
  imports = [
    (modulesPath + "/installer/scan/not-detected.nix")
  ];

  # Guide https://gist.github.com/CMCDragonkai/810f78ee29c8fce916d072875f7e1751
  boot.initrd.availableKernelModules = ["nvme" "xhci_pci" "ahci" "usb_storage" "usbhid" "sd_mod"];
  boot.initrd.kernelModules = [
    # GPU Driver
    "amdgpu"

    # VFIO Passtrough
    "vfio_pci"
    "vfio_iommu_type1"
    "vfio"
  ];

  boot.kernelModules = ["kvm-amd" "k10temp"];
  boot.extraModulePackages = [];

  # RoCM
  hardware.opengl.extraPackages = with pkgs; [
    rocm-opencl-icd
    rocm-opencl-runtime
  ];
  systemd.tmpfiles.rules = [
    "L+    /opt/rocm/hip   -    -    -     -    ${pkgs.rocmPackages.clr}"
  ];

  # Enable 32-bit support on 64-bit machine
  hardware.opengl.driSupport32Bit = true;

  # ====== Libvirt GPU Passhtough ======

  # GPU passthrough with VFIO
  # Ref https://github.com/j-brn/nixos-vfio/blob/bafcff87efa32ec8b014519d2b073484ebaeba5c/modules/vfio/default.nix
  services.udev.extraRules = ''
    SUBSYSTEM=="vfio", OWNER="root", GROUP="kvm"
  '';

  # Find PCI ID for devices you want to passtrough, my case 1002:73df is my GPU and the other is my audio.
  boot.kernelParams = [
    "amd_iommu=on"
    "iommu=pt"
    "vfio-pci.ids=1002:73df,1002:ab28,1022:1482,1022:1483,1002:1478,1002:1479"
  ];

  systemd.services."libvirt-nosleep@" = {
    description = "Preventing sleep while libvirt domain \"%i\" is running";
    serviceConfig = {
      ExecStart = "${pkgs.systemd}/bin/systemd-inhibit --what=sleep --why=\"Libvirt domain '%i' is running\" --who=%U --mode=block sleep infinity";
      Type = "simple";
    };
  };

  # Qemu hook
  virtualisation.libvirtd.hooks.qemu."win10" = "${customHookScript}";

  # ====================================

  fileSystems."/" = {
    device = "/dev/disk/by-uuid/1baa08d0-531c-4a07-8a67-b36e02d87f09";
    fsType = "ext4";
  };

  fileSystems."/boot" = {
    device = "/dev/disk/by-uuid/38DC-1458";
    fsType = "vfat";
    options = ["fmask=0022" "dmask=0022"];
  };

  swapDevices = [];

  # Enables DHCP on each ethernet and wireless interface. In case of scripted networking
  # (the default) this is the recommended approach. When using systemd-networkd it's
  # still possible to use this option, but it's recommended to use it in conjunction
  # with explicit per-interface declarations with `networking.interfaces.<interface>.useDHCP`.
  networking.useDHCP = lib.mkDefault true;
  # networking.interfaces.enp4s0.useDHCP = lib.mkDefault true;

  nixpkgs.hostPlatform = lib.mkDefault "x86_64-linux";
  hardware.cpu.amd.updateMicrocode = lib.mkDefault config.hardware.enableRedistributableFirmware;
}
