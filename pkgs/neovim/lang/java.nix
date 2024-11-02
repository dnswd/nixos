{ pkgs, lib, ... }: {
  plugins.nvim-jdtls = {
    enable = true;
    data = ''os.getenv("XDG_CACHE_HOME") .. '/jdtls/workspace' .. vim.fn.fnamemodify(vim.fn.getcwd(), ':p:h:t')'';
    configuration = ''os.getenv("XDG_CACHE_HOME") .. '/jdtls/config'';
    extraOptions = {
      cmd = [
        (lib.getExe pkgs.jdt-language-server)
        "-data"
        (lib.nixvim.mkRaw ''os.getenv("XDG_CACHE_HOME") .. "/jdtls/workspace/" .. vim.fn.fnamemodify(vim.fn.getcwd(), ":p:h:t")'')
        "-configuration"
        (lib.nixvim.mkRaw ''os.getenv("XDG_CACHE_HOME") .. "/jdtls/config"'')
        "-jar"
        (lib.nixvim.mkRaw ''vim.fn.glob("${pkgs.jdt-language-server}/share/java/jdtls/plugins/org.eclipse.equinox.launcher_*.jar")'')
        "-Declipse.application=org.eclipse.jdt.ls.core.id1"
        "-Dosgi.bundles.defaultStartLevel=4"
        "-Declipse.product=org.eclipse.jdt.ls.core.product"
        "-Dlog.protocol=true"
        "-Dlog.level=ALL"
        "-Xms1g"
        "-Xmx2G"
        "-javaagent:${pkgs.lombok}/share/java/lombok.jar"
        "--add-modules=ALL-SYSTEM"
        "--add-opens java.base/java.util=ALL-UNNAMED"
        "--add-opens java.base/java.lang=ALL-UNNAMED"

      ];
    };

    initOptions = {
      bundles =
        let
          base_path = "${pkgs.vscode-extensions.vscjava.vscode-java-debug}/share/vscode/extensions/vscjava.vscode-java-debug";
          package_json = builtins.fromJSON (builtins.readFile "${base_path}/package.json");
          jar_paths = builtins.map (e: "${base_path}/${e}") package_json.contributes.javaExtensions;
        in
        jar_paths;
    };

    extraOptions = {
      capabilities.__raw = "require('cmp_nvim_lsp').default_capabilities(vim.lsp.protocol.make_client_capabilities())";
    };

    settings = {
      java = {
        implementationsCodeLens.enable = true;
        referenceCodeLens.enable = true;
        signatureHelp.enable = true;

        # TODO fernflower isn't in nixpkgs rn https://github.com/NixOS/nixpkgs/issues/208672
        # contentProvider.preferred = "fernflower"; # decompilation
        configuration.updateBuildConfiguration = "interactive"; # default
        import = { gradle.enabled = true; maven.enabled = true; };
        saveActions.organizeImports = true;

        codeGeneration = {
          useBlocks = true;
          generateComments = true;
          hashCodeEquals = { useInstanceof = true; useJava7Objects = true; };
          # toString = {
          #   # codeStyle?: string;
          #   # limitElements?: number;
          #   # listArrayContents?: boolean;
          #   # skipNullValues?: boolean;
          #   # template?: string;
          # };
        };

        configuration.runtimes = [
          {
            name = "JavaSE-11";
            path = "${pkgs.temurin-bin-11}";
          }
          {
            name = "JavaSE-17";
            path = "${pkgs.temurin-bin-17}";
            default = true;
          }
          {
            name = "JavaSE-21";
            path = "${pkgs.temurin-bin-21}";
          }
        ];
        home = { };
        format.settings = { }; # url profile
      };
    };
  };
}
