#!/bin/bash

# === Environment Setup ===
# Support fnm, nvm, and direct installs in non-interactive SSH shells.

# 1) fnm (Fast Node Manager)
FNM_PATH="${HOME}/.local/share/fnm"
if [ -x "${FNM_PATH}/fnm" ]; then
  export PATH="${FNM_PATH}:${PATH}"
  eval "$(${FNM_PATH}/fnm env --shell bash)"
fi

# 2) nvm
export NVM_DIR="${HOME}/.nvm"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  . "${NVM_DIR}/nvm.sh"
fi

# 3) Common bin directories
export PATH="${HOME}/.local/bin:${HOME}/.local/share/pnpm:/usr/local/bin:${PATH}"

# Verify
echo "node: $(command -v node 2>/dev/null || echo NOT_FOUND) ($(node --version 2>/dev/null || echo -))"
echo "pnpm: $(command -v pnpm 2>/dev/null || echo NOT_FOUND) ($(pnpm --version 2>/dev/null || echo -))"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not found. Please install: npm install -g pnpm"
  exit 1
fi

# === Deploy ===
set -euo pipefail

REPO_DIR="${HOME}/repos/flowmark"
DEPLOY_DIR="${HOME}/flowmark"

echo "=== 开始部署 FlowMark ==="

echo ">>> 拉取代码..."
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

echo ">>> 构建后端..."
cd "$REPO_DIR/backend"
pnpm install --frozen-lockfile
pnpm build

echo ">>> 构建前端..."
cd "$REPO_DIR/frontend"
pnpm install --frozen-lockfile
pnpm build

echo ">>> 部署产物..."
rm -rf "$DEPLOY_DIR/dist" "$DEPLOY_DIR/static"
cp -r "$REPO_DIR/backend/dist" "$DEPLOY_DIR/dist"
cp -r "$REPO_DIR/frontend/dist" "$DEPLOY_DIR/static"
cp "$REPO_DIR/backend/package.json" "$DEPLOY_DIR/package.json"

cd "$REPO_DIR/backend"
pnpm install --frozen-lockfile --prod
rsync -a --delete "$REPO_DIR/backend/node_modules/" "$DEPLOY_DIR/node_modules/"
pnpm install --frozen-lockfile

echo ">>> 重启服务..."
sudo systemctl restart flowmark

echo "=== 部署完成 ==="
