# CLAUDE.md - FlowMark

个人工作流管理系统。看板、任务拆分、快捷记录、GitHub 集成。

## 技术栈
- 后端: Rust / Axum 0.8 / SQLite (sqlx)
- 前端: React 19 / Vite 8 / TailwindCSS 4 / TanStack Query / Zustand / dnd-kit
- 部署: Caddy + systemd，域名 fm.larrygo.com

## 构建与运行

```bash
# 后端
cd backend
cp .env.example .env  # 修改 JWT_SECRET
cargo run

# 前端开发
cd frontend
pnpm install
pnpm dev  # http://localhost:5173，代理 API 到 3200

# 前端构建
pnpm build  # 输出到 dist/
```

## 项目结构
- `backend/` — Rust Axum API 服务
- `backend/migrations/` — SQLite migration SQL
- `backend/src/routes/` — API 路由 (auth, projects, boards, columns, tasks, notes, dashboard, github)
- `backend/src/services/` — GitHub API 集成
- `frontend/` — React SPA
- `frontend/src/pages/` — 页面组件
- `frontend/src/components/` — 看板、任务卡片、详情面板等
- `frontend/src/api/` — API 调用封装
- `frontend/src/hooks/` — React Query hooks

## API 端点
所有 API 在 `/api/v1` 下，需要 JWT Bearer token（除 login/setup）。

## 注意事项
- 单用户系统，首次访问需设置密码
- SQLite WAL 模式，数据库文件在 backend/data/flowmark.db
- GitHub 集成需要在 .env 设置 GITHUB_TOKEN 以避免 rate limit
