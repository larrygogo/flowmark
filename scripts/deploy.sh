#!/bin/bash

# Load nvm (skip .bashrc interactive guard)
export NVM_DIR="${HOME}/.nvm"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  . "${NVM_DIR}/nvm.sh"
fi

# Add common tool locations to PATH
EXTRA_PATHS="${HOME}/.local/share/pnpm:${HOME}/.corepack/bin:${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin"
# Add nvm node bin if exists
for d in "${HOME}"/.nvm/versions/node/*/bin; do
  [ -d "$d" ] && EXTRA_PATHS="${d}:${EXTRA_PATHS}"
done
export PATH="${EXTRA_PATHS}:${PATH}"

# Fallback: find pnpm anywhere under HOME
if ! command -v pnpm >/dev/null 2>&1; then
  PNPM_BIN="$(find "${HOME}" -name pnpm -type f 2>/dev/null | head -1 || true)"
  if [ -n "${PNPM_BIN}" ]; then
    export PATH="$(dirname "${PNPM_BIN}"):${PATH}"
  fi
fi

echo "DEBUG: node=$(command -v node 2>/dev/null || echo NOT_FOUND)"
echo "DEBUG: pnpm=$(command -v pnpm 2>/dev/null || echo NOT_FOUND)"

# Fail if pnpm still not found
if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not found. Install it: npm install -g pnpm"
  exit 1
fi

set -euo pipefail

REPO_DIR="/home/ubuntu/repos/flowmark"
DEPLOY_DIR="/home/ubuntu/flowmark"

echo "=== 开始部署 FlowMark ==="

# 1. 拉取最新代码
echo ">>> 拉取代码..."
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

# 2. 构建后端
echo ">>> 构建后端..."
cd "$REPO_DIR/backend"
pnpm install --frozen-lockfile
pnpm build

# 3. 构建前端
echo ">>> 构建前端..."
cd "$REPO_DIR/frontend"
pnpm install --frozen-lockfile
pnpm build

# 4. 复制产物到运行目录
echo ">>> 部署产物..."
rm -rf "$DEPLOY_DIR/dist" "$DEPLOY_DIR/static"
cp -r "$REPO_DIR/backend/dist" "$DEPLOY_DIR/dist"
cp -r "$REPO_DIR/frontend/dist" "$DEPLOY_DIR/static"
cp "$REPO_DIR/backend/package.json" "$DEPLOY_DIR/package.json"

# 同步 node_modules（仅生产依赖）
cd "$REPO_DIR/backend"
pnpm install --frozen-lockfile --prod
cp -r "$REPO_DIR/backend/node_modules" "$DEPLOY_DIR/node_modules"
# 恢复完整依赖（含 devDependencies）
pnpm install --frozen-lockfile

# 5. 重启服务
echo ">>> 重启服务..."
sudo systemctl restart flowmark

echo "=== 部署完成 ==="
