{ lib, stdenv, fetchgit, bash, bun, ... }:

stdenv.mkDerivation rec {
  pname = "plannotator-pi-extension";
  version = "0.16.7";

  src = fetchgit {
    url = "https://github.com/backnotprop/plannotator.git";
    rev = "refs/tags/v${version}";
    hash = "sha256-1SHn2QSyuVAuIG7s4/eel6C59iouMTRE72hPIkUzbYo=";
  };

  nativeBuildInputs = [ bash bun ];

  dontConfigure = true;

  buildPhase = ''
    export HOME="$NIX_BUILD_TOP/home"
    mkdir -p "$HOME"

    # Copy source to writable location (bun needs to write to node_modules)
    export WRITABLE_SOURCE="$NIX_BUILD_TOP/source"
    mkdir -p "$WRITABLE_SOURCE"
    cp -r . "$WRITABLE_SOURCE/"
    cd "$WRITABLE_SOURCE"
    chmod -R +w .

    # Install dependencies (build-time network access required - no upstream lockfile)
    bun install --no-cache

    # Build order from package.json "build:pi": review → hook → pi-extension
    echo "Building apps/review..."
    bun run --cwd apps/review build

    echo "Building apps/hook..."
    bun run --cwd apps/hook build

    echo "Building apps/pi-extension..."
    bun run --cwd apps/pi-extension build
  '';

  installPhase = ''
    mkdir -p $out/lib/plannotator-pi-extension

    cd "$WRITABLE_SOURCE/apps/pi-extension"

    # Install only files listed in package.json "files" field:
    # index.ts, plannotator-browser.ts, plannotator-events.ts, server.ts,
    # tool-scope.ts, config.ts, plannotator.json, server/, generated/,
    # README.md, plannotator.html, review-editor.html, skills/

    for f in index.ts plannotator-browser.ts plannotator-events.ts server.ts \
             tool-scope.ts config.ts plannotator.json README.md \
             plannotator.html review-editor.html; do
      if [ -f "$f" ]; then
        cp -a "$f" $out/lib/plannotator-pi-extension/
      fi
    done

    # Copy directories
    for d in server generated skills; do
      if [ -d "$d" ]; then
        cp -a "$d" $out/lib/plannotator-pi-extension/
      fi
    done
  '';

  meta = with lib; {
    description = "Plannotator extension for Pi - interactive plan review with visual annotation";
    homepage = "https://github.com/backnotprop/plannotator";
    license = with licenses; [ mit asl20 ];
    platforms = platforms.all;
  };
}
