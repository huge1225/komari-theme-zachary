#!/bin/bash
set -e

echo "======================================"
echo "  Komari Nezha Theme Package Builder  "
echo "======================================"

export NODE_USE_ENV_PROXY=1

# Resolve theme version:
# 1. Explicit THEME_VERSION env var (e.g. from GitHub Actions)
# 2. If not set, read base major.minor from package.json and append git commit count (e.g. 1.2.5)
if [ -n "${THEME_VERSION}" ]; then
  FINAL_VERSION="${THEME_VERSION#v}"
else
  BASE_MAJOR_MINOR=$(python3 -c 'import json; v=json.load(open("package.json")).get("version","1.2.0").split("."); print(f"{v[0]}.{v[1]}")')
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")
    FINAL_VERSION="${BASE_MAJOR_MINOR}.${COMMIT_COUNT}"
  else
    FINAL_VERSION=$(python3 -c 'import json; print(json.load(open("package.json")).get("version","1.2.0"))')
  fi
fi

echo "[0/3] Syncing theme version -> ${FINAL_VERSION}"
python3 - <<PYEOF
import json

version = "${FINAL_VERSION}"

for path in ["komari-theme.json", "package.json"]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["version"] = version
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
PYEOF

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

echo "[3/3] Packaging theme zip (version ${FINAL_VERSION})..."
rm -rf theme-package
mkdir -p theme-package
cp komari-theme.json theme-package/
cp preview.webp theme-package/
[ -f "LICENSE" ] && cp LICENSE theme-package/
[ -f "NOTICE" ] && cp NOTICE theme-package/
cp -r dist/ theme-package/

ZIP_NAME="komari-theme-nezha-v${FINAL_VERSION}.zip"
rm -f "${ZIP_NAME}" "dist/${ZIP_NAME}" "komari-theme-nezha.zip"

if command -v zip >/dev/null 2>&1; then
  (cd theme-package && zip -qr "../${ZIP_NAME}" .)
else
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

echo "Successfully created theme package (version ${FINAL_VERSION}):"
ls -lh "${ZIP_NAME}" "komari-theme-nezha.zip"
