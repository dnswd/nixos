{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:
let
  jdtlsDebugJars =
    let
      base_path = "${pkgs.vscode-extensions.vscjava.vscode-java-debug}/share/vscode/extensions/vscjava.vscode-java-debug";
      package_json = builtins.fromJSON (builtins.readFile "${base_path}/package.json");
    in
    builtins.map (e: "${base_path}/${e}") package_json.contributes.javaExtensions;

  # Use jdtls 1.43.0 from pinned nixpkgs - last version with Java 17 bytecode
  # This is required for compatibility with Gradle 6.x projects
  pkgs-jdtls = import inputs.nixpkgs-jdtls {
    inherit (pkgs) system;
    config.allowUnfree = true;
  };

  # jdtls 1.43.0 with Java 17 runtime
  jdtls143 = pkgs-jdtls.jdt-language-server.override {
    jdk = pkgs.jdk17;
  };
in
{
  extraPackages = [ pkgs.checkstyle ];

  plugins.lint = {
    enable = true;
    lintersByFt.java = [ "checkstyle" ];
    linters.checkstyle = {
      cmd = lib.getExe pkgs.checkstyle;
      args = [
        "-c"
        {
          __raw = ''
            (function()
              local root = vim.fn.getcwd()
              local candidates = {
                root .. "/checkstyle.xml",
                root .. "/config/checkstyle/checkstyle.xml",
                root .. "/.checkstyle.xml",
              }
              for _, path in ipairs(candidates) do
                if vim.fn.filereadable(path) == 1 then
                  return path
                end
              end
              -- Fallback to Google style
              return "/google_checks.xml"
            end)()
          '';
        }
        { __raw = "vim.api.nvim_buf_get_name(0)"; }
      ];
    };
  };

  plugins.jdtls = {
    enable = true;
    jdtLanguageServerPackage = jdtls143;

    settings = {
      cmd = [
        (lib.getExe jdtls143)
        "-data"
        {
          __raw = ''os.getenv("XDG_CACHE_HOME") .. "/jdtls/workspace/" .. vim.fn.fnamemodify(vim.fn.getcwd(), ":p:h:t")'';
        }
        "-configuration"
        { __raw = ''os.getenv("XDG_CACHE_HOME") .. "/jdtls/config"''; }
        "-javaagent:${pkgs.lombok}/share/java/lombok.jar"
      ];

      root_dir.__raw = ''require('jdtls.setup').find_root({'settings.gradle', 'settings.gradle.kts', 'pom.xml', '.git', 'mvnw', 'gradlew'})'';

      init_options.bundles = jdtlsDebugJars;

      settings.java = {
        configuration = {
          updateBuildConfiguration = "interactive";
          runtimes = [
            {
              name = "JavaSE-1.8";
              path = "${pkgs.jdk8}/lib/openjdk";
            }
            {
              name = "JavaSE-17";
              path = "${pkgs.jdk17}/lib/openjdk";
              default = true;
            }
            {
              name = "JavaSE-21";
              path = "${pkgs.jdk21}/lib/openjdk";
            }
          ];
        };

        import = {
          gradle = {
            enabled = true;
            java.home = "${pkgs.jdk8}/lib/openjdk";
            wrapper.enabled = true;
          };
          maven.enabled = true;
        };

        implementationsCodeLens.enabled = true;
        referencesCodeLens.enabled = true;
        signatureHelp.enabled = true;
        saveActions.organizeImports = true;

        codeGeneration = {
          useBlocks = true;
          generateComments = true;
          hashCodeEquals = {
            useInstanceof = true;
            useJava7Objects = true;
          };
          toString = {
            skipNullValues = true;
            listArrayContents = true;
          };
        };

        format.enabled = true;

        completion = {
          favoriteStaticMembers = [
            "org.junit.Assert.*"
            "org.junit.jupiter.api.Assertions.*"
            "org.mockito.Mockito.*"
            "org.mockito.ArgumentMatchers.*"
          ];
          importOrder = [
            "java"
            "javax"
            "org"
            "com"
            ""
          ];
        };
      };
    };
  };

  extraConfigLua = # lua
    ''
      -- Project-local Java formatter detection
      -- Searches for Eclipse formatter XML in common locations per microservice
      local function find_project_formatter()
        local root = vim.fn.getcwd()
        local candidates = {
          root .. "/checkstyle.xml",
          root .. "/config/checkstyle/checkstyle.xml",
          root .. "/.checkstyle.xml",
          root .. "/eclipse-formatter.xml",
          root .. "/.settings/org.eclipse.jdt.core.prefs",
          root .. "/formatter.xml",
        }
        for _, path in ipairs(candidates) do
          if vim.fn.filereadable(path) == 1 then
            return path
          end
        end
        return nil
      end

      -- Java DAP configuration
      local function setup_java_dap()
        local dap = require('dap')

        dap.configurations.java = {
          {
            type = 'java',
            request = 'attach',
            name = 'Debug (Attach) - Remote',
            hostName = '127.0.0.1',
            port = 5005,
          },
          {
            type = 'java',
            request = 'launch',
            name = 'Debug (Launch)',
            mainClass = "",
          },
        }
      end

      -- Setup when jdtls attaches
      vim.api.nvim_create_autocmd("FileType", {
        pattern = "java",
        callback = function()
          local jdtls = require('jdtls')

          -- Apply project-local formatter settings
          local formatter_path = find_project_formatter()
          if formatter_path then
            local clients = vim.lsp.get_clients({ name = 'jdtls' })
            for _, client in ipairs(clients) do
              client.config.settings.java = client.config.settings.java or {}
              client.config.settings.java.format = client.config.settings.java.format or {}
              client.config.settings.java.format.settings = {
                url = formatter_path,
              }
              client.notify('workspace/didChangeConfiguration', { settings = client.config.settings })
            end
          end

          -- Java-specific keymaps
          local opts = { buffer = true, silent = true }
          vim.keymap.set('n', '<leader>jo', jdtls.organize_imports, vim.tbl_extend('force', opts, { desc = '[J]ava [O]rganize imports' }))
          vim.keymap.set('n', '<leader>jv', jdtls.extract_variable, vim.tbl_extend('force', opts, { desc = '[J]ava extract [V]ariable' }))
          vim.keymap.set('v', '<leader>jv', function() jdtls.extract_variable(true) end, vim.tbl_extend('force', opts, { desc = '[J]ava extract [V]ariable' }))
          vim.keymap.set('n', '<leader>jc', jdtls.extract_constant, vim.tbl_extend('force', opts, { desc = '[J]ava extract [C]onstant' }))
          vim.keymap.set('v', '<leader>jc', function() jdtls.extract_constant(true) end, vim.tbl_extend('force', opts, { desc = '[J]ava extract [C]onstant' }))
          vim.keymap.set('v', '<leader>jm', function() jdtls.extract_method(true) end, vim.tbl_extend('force', opts, { desc = '[J]ava extract [M]ethod' }))

          -- Test keymaps
          vim.keymap.set('n', '<leader>jt', jdtls.test_nearest_method, vim.tbl_extend('force', opts, { desc = '[J]ava [T]est nearest method' }))
          vim.keymap.set('n', '<leader>jT', jdtls.test_class, vim.tbl_extend('force', opts, { desc = '[J]ava [T]est class' }))

          -- Setup DAP
          pcall(function()
            jdtls.setup_dap({ hotcodereplace = 'auto' })
            setup_java_dap()
          end)
        end,
      })
    '';
}
