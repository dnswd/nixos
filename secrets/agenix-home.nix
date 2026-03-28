# Home-manager agenix configuration
# Secrets are decrypted directly to where programs expect them
{
  config,
  lib,
  ...
}:
{
  age = {
    identityPaths = [ "${config.home.homeDirectory}/.ssh/id_rsa" ];
    
    secrets = {
      # Git user config - included via git's include.path
      gitconfig = {
        file = ./gitconfig.age;
        path = "${config.home.homeDirectory}/.config/git/config.secret";
      };
      
      # Bitwarden CLI config
      rbw-config = {
        file = ./rbw-config.json.age;
        path = "${config.xdg.configHome}/rbw/config.json";
      };
      
      # Pi-mono auth
      pi-auth = {
        file = ./pi-auth.json.age;
        path = "${config.home.homeDirectory}/.pi/agent/auth.json";
      };
    };
  };
}
