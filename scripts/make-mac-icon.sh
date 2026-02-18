#!/usr/bin/env bash
set -euo pipefail

SRC="${1:-build/icons/source.png}"
OUT_DIR="build/icons"
ICONSET_DIR="$OUT_DIR/AliImagePull.iconset"
ICNS_PATH="$OUT_DIR/AliImagePull.icns"

if [[ ! -f "$SRC" ]]; then
  echo "Source image not found: $SRC"
  echo "Usage: npm run icon:mac -- /absolute/path/to/icon.png"
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

sips -z 16 16     "$SRC" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32     "$SRC" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32     "$SRC" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64     "$SRC" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128   "$SRC" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256   "$SRC" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$SRC" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512   "$SRC" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$SRC" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$SRC" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null

iconutil -c icns "$ICONSET_DIR" -o "$ICNS_PATH"

echo "Generated: $ICNS_PATH"
