#!/bin/bash

# Load full user environment for non-interactive SSH sessions
[ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc"
[ -f "$HOME/.profile" ] && source "$HOME/.profile"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
# Common pnpm locations
for p in "$HOME/.local/share/pnpm" "$HOME/.corepack/bin" "$HOME/.local/bin"; do
  [ -d "$p" ] && export PATH="$p:$PATH"
done

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
