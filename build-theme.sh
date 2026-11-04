#!/bin/bash
set -e

echo "======================================"
echo "  Komari Nezha Theme Package Builder  "
echo "======================================"

export NODE_USE_ENV_PROXY=1

echo "[1/3] Building frontend assets..."
pnpm run build

echo "[2/3] Verifying required theme files..."
if [ ! -f "komari-theme.json" ]; then
  echo "Error: komari-theme.json not found!"
  exit 1
fi

if [ ! -f "preview.webp" ]; then
  cp public/animated-man.webp preview.webp
fi

if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
  echo "Error: dist/index.html not found!"
  exit 1
fi

echo "[3/3] Packaging theme zip..."
VERSION_DATE=$(date +"%y.%m.%d")
rm -rf theme-package
mkdir -p theme-package
cp komari-theme.json theme-package/
cp preview.webp theme-package/
[ -f "LICENSE" ] && cp LICENSE theme-package/
[ -f "NOTICE" ] && cp NOTICE theme-package/
cp -r dist/ theme-package/

ZIP_NAME="komari-theme-nezha-v${VERSION_DATE}.zip"
rm -f "${ZIP_NAME}" "dist/${ZIP_NAME}" "komari-theme-nezha.zip"

if command -v zip >/dev/null 2>&1; then
  (cd theme-package && zip -qr "../${ZIP_NAME}" .)
else
  python3 -m zipfile -c "${ZIP_NAME}" theme-package/komari-theme.json theme-package/preview.webp theme-package/dist
  # Re-pack with root-relative paths inside theme-package
  python3 - <<PYEOF
import os, zipfile
zip_path = "${ZIP_NAME}"
src_dir = "theme-package"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(src_dir):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, src_dir)
            zf.write(full_path, rel_path)
PYEOF
fi

cp "${ZIP_NAME}" "komari-theme-nezha.zip"
rm -rf theme-package

echo "Successfully created theme package:"
ls -lh "${ZIP_NAME}" "komari-theme-nezha.zip"
