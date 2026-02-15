{
  pkgs,
  lib,
  extensions-src,
  pi-mono-src,
  nodePkg,
  pnpmPkg,
}:

let
  pnpm = if (pnpmPkg != null) then pnpmPkg else pkgs.pnpm_10;
  nodejs = if (nodePkg != null) then nodePkg else pkgs.nodejs_24;

  piVersion =
    (builtins.fromJSON (builtins.readFile (pi-mono-src + "/packages/coding-agent/package.json")))
    .version;

  extSrc = pkgs.lib.cleanSourceWith {
    src = extensions-src;
    filter =
      p: _t:
      let
        name = baseNameOf p;
      in
      !builtins.elem name [
        "node_modules"
        "dist"
        ".direnv"
        ".devenv"
      ];
  };

  buildScript = pkgs.writeText "build-extension.mjs" ''
    import { readFile } from "node:fs/promises";
    import { createRequire } from "node:module";
    import { resolve } from "node:path";

    const cwd = process.cwd();
    const require = createRequire(resolve(cwd, "..", "package.json"));
    const { build } = require("esbuild");
    const packageJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8"));
    const peerDeps = Object.keys(packageJson.peerDependencies ?? {});

    await build({
      entryPoints: [resolve(cwd, "index.ts")],
      outfile: resolve(cwd, "dist/index.js"),
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node18",
      external: ["@mariozechner/*", ...peerDeps],
    });
  '';

  pnpmDeps = pkgs.stdenvNoCC.mkDerivation {
    pname = "pi-mono-extensions-pnpm-deps";
    version = "1.0.0";
    src = extSrc;

    nativeBuildInputs = [ nodejs pnpm pkgs.cacert ];

    outputHashMode = "recursive";
    outputHashAlgo = "sha256";
    outputHash = "sha256-ZjlZEgJXhK/tHMCEtEYkb5F3Iy6/6IziHGt1NDyOA5Q=";

    buildPhase = ''
      runHook preBuild
      export HOME=$TMPDIR

      # Remove packageManager to prevent pnpm self-update attempts
      ${pkgs.jq}/bin/jq 'del(.packageManager)' package.json > package.json.tmp
      mv package.json.tmp package.json

      pnpm config set store-dir $TMPDIR/pnpm-store
      pnpm install --frozen-lockfile --ignore-scripts
      runHook postBuild
    '';

    dontFixup = true;

    installPhase = ''
      runHook preInstall
      mkdir -p $out
      cp -r . $out/
      runHook postInstall
    '';
  };
in
pkgs.stdenvNoCC.mkDerivation {
  pname = "pi-mono-extensions";
  version = "1.0.0";

  src = extSrc;

  nativeBuildInputs = [
    nodejs
    pnpm
  ];

  buildPhase = ''
    runHook preBuild

    export HOME=$TMPDIR
    cp -r ${pnpmDeps}/* .
    chmod -R u+w .

    declaredVersion=$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).devDependencies['@mariozechner/pi-coding-agent']")
    if [ "${piVersion}" != "$declaredVersion" ]; then
      echo "ERROR: pi-mono version mismatch (input: ${piVersion}, declared: $declaredVersion)" >&2
      exit 1
    fi

    for dir in */; do
      [ -f "$dir/index.ts" ] && echo "Building $dir" && (cd "$dir" && node ${buildScript})
    done

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    for dir in */; do
      [ -f "$dir/dist/index.js" ] && mkdir -p "$out/$dir" && cp -r "$dir"/{dist,package.json} "$out/$dir/"
    done

    runHook postInstall
  '';
}
