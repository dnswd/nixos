{
  config,
  lib,
  ...
}:
{
  age.secrets.identity = {
    file = ./identity.json.age;
    mode = "0440";
    group = "users";
  };
}
