{
  ...
}: {

  plugins.comment = {
    enable = true;
    settings.pre_hook = /* lua */ ''
      require('ts_context_commentstring.integrations.comment_nvim').create_pre_hook()
    '';
  };

  # JSX context for comments
  plugins.ts-context-commentstring.enable = true;

}
