import 'dotenv/config';
import { v4 as uuid } from 'uuid';
import { getDb, runMigrations } from './db.js';

runMigrations();
const db = getDb();

const projects = [
  { name: 'FlowMark', description: '个人工作流管理系统，人与 AI 的共享记忆层', github_url: 'https://github.com/larrygogo/flowmark', color: '#6366f1', group: '个人项目' },
  { name: 'OpenClaw', description: 'AI Agent 框架，4-agent 架构，高性能网关', github_url: null, color: '#f59e0b', group: '个人项目' },
  { name: 'ClawMo', description: 'OpenClaw Gateway iOS 客户端', github_url: 'https://github.com/larrygogo/ClawMo', color: '#3b82f6', group: '个人项目' },
  { name: 'ClawMo-Push', description: 'OpenClaw APNs 推送插件', github_url: 'https://github.com/larrygogo/clawmo-push', color: '#8b5cf6', group: '个人项目' },
  { name: 'ClawMo-Relay', description: 'APNs 推送中继服务 (Rust/Axum)', github_url: 'https://github.com/larrygogo/clawmo-relay', color: '#ec4899', group: '个人项目' },
  { name: 'Autopilot', description: '轻量多阶段任务编排引擎 (Python)', github_url: 'https://github.com/larrygogo/autopilot', color: '#10b981', group: '个人项目' },
  { name: 'CloudDash', description: '云资源管理面板', github_url: null, color: '#06b6d4', group: '个人项目' },
  { name: 'XBot', description: '跨平台自动化购票系统 (Tauri + Rust)', github_url: 'https://github.com/ReverseGame/reverse-bot-gui', color: '#ef4444', group: '公司项目' },
  { name: 'XBot-JS-Service', description: 'NestJS 服务端', github_url: 'https://github.com/ReverseGame/xbot-js-service', color: '#f97316', group: '公司项目' },
  { name: 'Moretickets Auto-Pricer', description: 'Chrome 扩展，自动定价', github_url: 'https://github.com/ReverseGame/moretickets-auto-pricer', color: '#14b8a6', group: '公司项目' },
  { name: 'ReqGenie', description: 'AI 驱动需求管理系统', github_url: 'https://github.com/ReverseGame/reqgenie', color: '#a855f7', group: '公司项目' },
];

function parseGithubUrl(url: string | null): [string | null, string | null] {
  if (!url) return [null, null];
  const p = url.replace(/^https?:\/\//, '').replace(/^git@github\.com:/, '').replace('github.com/', '').replace(/\.git$/, '').replace(/\/$/, '');
  const parts = p.split('/');
  return parts.length >= 2 ? [parts[0], parts[1]] : [null, null];
}

const insertProject = db.prepare(
  'INSERT OR IGNORE INTO projects (id, name, description, group_name, github_url, github_owner, github_repo, color, position) VALUES (?,?,?,?,?,?,?,?,?)'
);
const insertBoard = db.prepare('INSERT INTO boards (id, project_id, name, position) VALUES (?,?,?,0)');
const insertColumn = db.prepare('INSERT INTO columns (id, board_id, name, color, position) VALUES (?,?,?,?,?)');

const existing = new Set((db.prepare('SELECT name FROM projects').all() as any[]).map(r => r.name));

const tx = db.transaction(() => {
  let pos = (db.prepare('SELECT MAX(position) as m FROM projects').get() as any)?.m ?? -1;
  for (const p of projects) {
    if (existing.has(p.name)) { console.log(`Skip (exists): ${p.name}`); continue; }
    const id = uuid();
    const [owner, repo] = parseGithubUrl(p.github_url);
    pos++;
    insertProject.run(id, p.name, p.description, p.group, p.github_url, owner, repo, p.color, pos);

    const boardId = uuid();
    insertBoard.run(boardId, id, 'Default');
    for (const [cn, cc, cp] of [['Todo', '#94a3b8', 0], ['In Progress', '#6366f1', 1], ['Done', '#22c55e', 2]] as const) {
      insertColumn.run(uuid(), boardId, cn, cc, cp);
    }
    console.log(`Imported: ${p.name}`);
  }
});

tx();
console.log('Done');
