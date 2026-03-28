let
  # Dennis MacBook Pro
  dennis = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDFBV/ipK2uZNIx+v7aEloglqa9680Toc32ANnKPBorfM81OwAp6kK0dSPEjT36s4d33hGnHqlkvHXhfDpyhqO8wWA3hL7+wFJ+qpnok9OApWeT3wdleeUydcleauhMm9Z88FZftKZtm6LFf0unJ4Etj/RwiXebS5cvZXyQbmp/+Kc3a02BeCc52llMhC5l8AtU7ej2IM1C2+CFKCqYb6QcTmpCFpsVtxgnLr65nflEwHzJuLztfMwiY8u12w+J6PhnaTOKgMTle1lhCDQP6h7nD46YVr+UYWbuf6NnfA2FIqPZC69tsnSfleGt1RXHnn1+9jxL6XPkUaJcUDDH8qVrCTiBOIkqbgQ1Q3WEE1TSAgF97SFDb4C6kM9xa0gThwu2FiUp6Lt3ohYdlTku0UV2LCe4XFVqKVAwOQ7Wd/j2t0l0d7xtES5GUHCY1PqPetCN5WiqcpU7Y20xohj8g5woeE82Q0CVzVrGv8P+IJG8WIFFR5/e6+XSy36m0gELi3c=";

  # Halcyon on ikigai (NixOS)
  halcyon = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC9P2nbiIhutHbthEN/tbOXt6y2WWVQFxGyvRROWuxHI";

  users = [ dennis halcyon ];
in
{
  # Legacy - contains all identity info in one file
  "identity.json.age".publicKeys = users;
  
  # Program-specific secrets (decrypt directly to where programs expect them)
  "gitconfig.age".publicKeys = users;
  "rbw-config.json.age".publicKeys = users;
  "pi-auth.json.age".publicKeys = users;
}
