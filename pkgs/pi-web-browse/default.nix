{ lib, pkgs, stdenv, nodejs, fetchgit, ... }:

let
  cli = stdenv.mkDerivation rec {
    pname = "pi-web-browse-cli";
    version = "1.0.5";

    src = fetchgit {
      url = "https://github.com/ogulcancelik/pi-extensions.git";
      rev = "d4e61c0a8be814c465b9224b26f05a0310c94d7a"; # latest
      hash = "sha256-yErbEG9KJ+azEoLYEkz0yxZ3mb1SzRTabv8Op3rPxP8=";
    };

    # npmDeps must be a derivation attr (not in let) for npmConfigHook
    npmDeps = pkgs.fetchNpmDeps {
      inherit src;
      name = "${pname}-${version}-npm-deps";
      hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    };

    # Use npmWorkspace so npmConfigHook installs in the right directory
    npmWorkspace = "packages/pi-web-browse";
    sourceRoot = ".";

    nativeBuildInputs = [
      nodejs
      pkgs.npmHooks.npmConfigHook
    ];

    # npmConfigHook runs npm install automatically - no buildPhase needed

    installPhase = ''
      mkdir -p $out/lib/pi-web-browse

      # Copy all CLI files from workspace subdirectory
      cp -r packages/pi-web-browse/lib $out/lib/pi-web-browse/
      cp packages/pi-web-browse/web-browse.js $out/lib/pi-web-browse/
      cp packages/pi-web-browse/package.json $out/lib/pi-web-browse/
      cp packages/pi-web-browse/README.md $out/lib/pi-web-browse/ 2>/dev/null || true
      cp packages/pi-web-browse/LICENSE $out/lib/pi-web-browse/ 2>/dev/null || true

      # Copy node_modules from workspace subdirectory (where npm installed)
      cp -r packages/pi-web-browse/node_modules $out/lib/pi-web-browse/

      # Remove unnecessary cache files to save space
      rm -rf $out/lib/pi-web-browse/node_modules/.cache 2>/dev/null || true
      
      # Fix broken symlinks (npm creates self-referential symlinks)
      rm -rf $out/lib/pi-web-browse/node_modules/.bin 2>/dev/null || true
      rm -rf $out/lib/pi-web-browse/node_modules/@ogulcancelik 2>/dev/null || true
    '';

    meta = with lib; {
      description = "Web search and content extraction CLI for pi-mono using headless browser";
      homepage = "https://github.com/ogulcancelik/pi-extensions/tree/main/packages/pi-web-browse";
      license = licenses.mit;
      platforms = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
    };
  };

  # Extension wrapper that registers tools with pi
  extension = pkgs.writeTextFile {
    name = "pi-web-browse-extension";
    destination = "/lib/pi-web-browse/extension/index.ts";
    text = ''
      import { Type } from "@sinclair/typebox";
      import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
      import { spawn } from "node:child_process";

      const WEB_BROWSE_PATH = "${cli}/lib/pi-web-browse/web-browse.js";

      function runWebBrowse(args: string[], signal?: AbortSignal): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve) => {
          const proc = spawn("node", [WEB_BROWSE_PATH, ...args], {
            stdio: ["pipe", "pipe", "pipe"],
            shell: false,
          });

          let stdout = "";
          let stderr = "";

          proc.stdout?.on("data", (data) => stdout += data.toString());
          proc.stderr?.on("data", (data) => stderr += data.toString());

          const cleanup = () => proc.kill();
          signal?.addEventListener("abort", cleanup);

          proc.on("close", (exitCode) => {
            signal?.removeEventListener("abort", cleanup);
            resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
          });

          proc.on("error", (err) => {
            signal?.removeEventListener("abort", cleanup);
            resolve({ stdout, stderr: err.message, exitCode: 1 });
          });
        });
      }

      export default function (pi: ExtensionAPI) {
        pi.registerTool({
          name: "web_search",
          label: "Web Search",
          description: `Search the web using Google (with DuckDuckGo fallback). Returns titles, URLs, and snippets.

      Uses a real headless browser (CDP) to bypass bot protection. First use requires enabling browser remote debugging.

      Use when:
      - Finding current info not in the codebase
      - Looking for documentation, libraries, APIs
      - Researching solutions online

      Results are cached for ~10 minutes.`,

          parameters: Type.Object({
            query: Type.String({ description: "Search query" }),
            numResults: Type.Optional(Type.Number({ default: 5, minimum: 1, maximum: 10 })),
          }),

          async execute(_id, params, signal, onUpdate) {
            const { query, numResults = 5 } = params;
            onUpdate?.({ content: [{ type: "text", text: `🔍 Searching: "''${query}"...` }] });

            const { stdout, stderr, exitCode } = await runWebBrowse([query, "-n", String(numResults)], signal);

            if (signal?.aborted) {
              return { content: [{ type: "text", text: "Search aborted." }] };
            }

            if (exitCode !== 0 && !stdout) {
              const isBrowserError = stderr.includes("browser") || stderr.includes("Chrome") || stderr.includes("CDP");
              if (isBrowserError) {
                return {
                  content: [{
                    type: "text",
                    text: `⚠️ Browser setup required:\n\n1. Open Chrome/Brave/Edge\n2. Go to: chrome://inspect/#remote-debugging\n3. Enable "Remote debugging"\n4. Retry\n\nOr set WEB_BROWSE_BROWSER_BIN to browser path.`
                  }],
                  isError: true,
                };
              }
              return { content: [{ type: "text", text: `Error: ''${stderr}` }], isError: true };
            }

            return {
              content: [{ type: "text", text: stdout || "No results found." }],
              details: { query, numResults },
            };
          },
        });

        pi.registerTool({
          name: "web_fetch",
          label: "Web Fetch",
          description: `Fetch content from a specific URL using headless browser. Bypasses bot protection.

      Use when:
      - Reading documentation pages
      - Fetching JS-rendered content
      - Sites block curl/wget

      Truncated by default (~2000 chars). Use fullContent for complete output.`,

          parameters: Type.Object({
            url: Type.String({ description: "Full URL to fetch" }),
            fullContent: Type.Optional(Type.Boolean({ default: false })),
          }),

          async execute(_id, params, signal, onUpdate) {
            const { url, fullContent = false } = params;
            onUpdate?.({ content: [{ type: "text", text: `📄 Fetching: ''${url}...` }] });

            const args = ["--url", url];
            if (fullContent) args.push("--full");

            const { stdout, stderr, exitCode } = await runWebBrowse(args, signal);

            if (signal?.aborted) {
              return { content: [{ type: "text", text: "Fetch aborted." }] };
            }

            if (exitCode !== 0 && !stdout) {
              return { content: [{ type: "text", text: `Error fetching ''${url}: ''${stderr}` }], isError: true };
            }

            return {
              content: [{ type: "text", text: stdout || "No content found." }],
              details: { url, fullContent },
            };
          },
        });
      }
    '';
  };

  # Extension subdirectory metadata package.json
  extensionPackageJson = pkgs.writeTextFile {
    name = "pi-web-browse-extension-package-json";
    destination = "/lib/pi-web-browse/extension/package.json";
    text = ''
      {
        "name": "pi-web-browse",
        "version": "1.0.5",
        "private": true,
        "type": "module",
        "pi": {
          "extensions": ["./index.ts"]
        }
      }
    '';
  };
in

# Use runCommand to properly merge everything and override package.json
pkgs.runCommand "pi-web-browse"
  {
    meta = with lib; {
      description = "Web search and content extraction extension for pi-mono using headless browser";
      homepage = "https://github.com/ogulcancelik/pi-extensions/tree/main/packages/pi-web-browse";
      license = licenses.mit;
      platforms = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
    };
  }
  ''
    mkdir -p $out/lib/pi-web-browse

    # Copy CLI files (lib, web-browse.js, node_modules, etc.)
    cp -r ${cli}/lib/pi-web-browse/lib $out/lib/pi-web-browse/
    cp ${cli}/lib/pi-web-browse/web-browse.js $out/lib/pi-web-browse/
    cp -r ${cli}/lib/pi-web-browse/node_modules $out/lib/pi-web-browse/

    # Copy optional files if they exist
    cp ${cli}/lib/pi-web-browse/README.md $out/lib/pi-web-browse/ 2>/dev/null || true
    cp ${cli}/lib/pi-web-browse/LICENSE $out/lib/pi-web-browse/ 2>/dev/null || true

    # Copy extension files
    mkdir -p $out/lib/pi-web-browse/extension
    cp ${extension}/lib/pi-web-browse/extension/index.ts $out/lib/pi-web-browse/extension/
    cp ${extensionPackageJson}/lib/pi-web-browse/extension/package.json $out/lib/pi-web-browse/extension/

    # Write the root package.json with pi.extensions (regular file, not symlink)
    cat > $out/lib/pi-web-browse/package.json << 'EOF'
    {
      "name": "@ogulcancelik/pi-web-browse",
      "version": "1.0.5",
      "description": "Web search and content extraction extension for pi-mono using headless browser",
      "type": "module",
      "main": "web-browse.js",
      "bin": {
        "web-browse": "web-browse.js"
      },
      "keywords": [
        "pi-package",
        "pi-extension",
        "web-search",
        "web-scraping",
        "browser-automation",
        "cdp",
        "headless-browser",
        "playwright"
      ],
      "author": "Can Celik",
      "license": "MIT",
      "repository": {
        "type": "git",
        "url": "git+https://github.com/ogulcancelik/pi-extensions.git",
        "directory": "packages/pi-web-browse"
      },
      "homepage": "https://github.com/ogulcancelik/pi-extensions/tree/main/packages/pi-web-browse#readme",
      "engines": {
        "node": ">=18.0.0"
      },
      "os": ["linux", "darwin", "win32"],
      "pi": {
        "extensions": ["./extension/index.ts"],
        "skills": ["./SKILL.md"]
      }
    }
    EOF
  ''
