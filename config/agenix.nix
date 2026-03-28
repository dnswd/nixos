{
  config,
  lib,
  ...
}:
let
  secretsPath = ../secrets;
in
{
  age.secrets.identity = {
    file = "${secretsPath}/identity.json.age";
    mode = "0440";
    group = "users";
  };
}
