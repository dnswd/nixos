{ pkgs, ... }: {
  # You need to enable java in home-manager, sadly nixvim and home-manager config can
  # plugins.nvim-jdtls = {
  #   enable = true;
  #   data = "~/.cache/jdtls/workspace";
  #   configuration = "~/.cache/jdtls/config";
  #   rootDir = { __raw = "require('jdtls.setup').find_root({'.git', 'mvnw', 'gradlew'})"; };
  #   initOptions = {
  #     bundles = [
  #       "${pkgs.vscode-extensions.vscjava.vscode-java-debug}/share/vscode/extensions/vscjava.vscode-java-debug/server/com.microsoft.java.debug.plugin-0.50.0.jar"
  #     ];
  #   };
  # };

  # plugins.nvim-jdtls = {
  #   enable = true;
  #   # sneak into `.idea` project folder
  #   data = ".idea/nvim-jdtls";
  # };

  # plugins.nvim-jdtls = {
  # plugins.nvim-jdtls = {
  #   enable = true;
  #   cmd = [
  #     "${pkgs.jdt-language-server}/bin/jdtls"
  #   ];
  #   # configuration = "/path/to/configuration";
  #   data = "~/.cache/jdtls/workspace";
  #   settings = {
  #     java = {
  #       signatureHelp = true;
  #       completion = true;
  #     };
  #   };
  #   initOptions = {
  #     bundles = [
  #       "${java-test}"
  #       "${java-debug}"
  #     ];
  #   };
  # };

  # extraPlugins = with pkgs.vimPlugins; [
  #   nvim-jdtls
  # ];
  #
  # # plugins.lsp.servers.jdtls = {
  # #   enable = true;
  # # };
  #
  # extraFiles = {
  #   "ftplugin/java.lua".text = ''
  #     local config = {
  #       cmd = {'${pkgs.jdt-language-server}/bin/jdtls', '--jvm-arg=-javaagent:${pkgs.lombok}/share/java/lombok.jar', '--jvm-arg=-Xbootclasspath/a:${pkgs.lombok}/share/java/lombok.jar'},
  #       root_dir = vim.fs.dirname(vim.fs.find({'gradlew', '.git', 'mvnw'}, { upward = true })[1]),
  #     }
  #     require('jdtls').start_or_attach(config)
  #   '';
  # };
  #
  #
  # plugins.lsp.servers.java_language_server = {
  #   enable = true;
  #   # package = pkgs."jdt-language-server";
  # };

  # plugins.nvim-jdtls = {
  #   enable = true;
  # };
}
