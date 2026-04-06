import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { getDb, runMigrations } from './db.js';

runMigrations();

const server = new McpServer({
  name: 'flowmark',
  version: '0.2.0',
});

// --- Tools ---

// List all projects
server.tool('list_projects', '列出所有项目', {}, () => {
  const rows = getDb().prepare('SELECT id, name, description, github_url, color, archived FROM projects ORDER BY position').all();
  return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
});

// Get project detail with boards, columns, task counts
server.tool('get_project', '获取项目详情（含看板、列、任务数）', { project_id: z.string().describe('项目 ID') }, ({ project_id }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any;
  if (!project) return { content: [{ type: 'text', text: 'Project not found' }], isError: true };
  const boards = db.prepare('SELECT * FROM boards WHERE project_id = ? ORDER BY position').all(project_id);
  const result = {
    ...project,
    boards: (boards as any[]).map(b => ({
      ...b,
      columns: (db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(b.id) as any[]).map(c => ({
        ...c,
        task_count: (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE column_id = ? AND parent_task_id IS NULL').get(c.id) as any).c,
      })),
    })),
  };
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

// Create a new project
server.tool('create_project', '创建新项目', {
  name: z.string().describe('项目名称'),
  description: z.string().optional().describe('项目描述'),
  github_url: z.string().optional().describe('GitHub 仓库 URL'),
  color: z.string().optional().describe('项目颜色 hex'),
}, ({ name, description, github_url, color }) => {
  const db = getDb();
  const id = uuid();
  const [go, gr] = github_url ? parseGithubUrl(github_url) : [null, null];
  const maxPos = (db.prepare('SELECT MAX(position) as m FROM projects').get() as any)?.m ?? -1;
  db.prepare('INSERT INTO projects (id, name, description, github_url, github_owner, github_repo, color, position) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, name, description || '', github_url || null, go, gr, color || '#6366f1', maxPos + 1);

  // Default board + columns
  const boardId = uuid();
  db.prepare('INSERT INTO boards (id, project_id, name, position) VALUES (?,?,?,0)').run(boardId, id, 'Default');
  for (const [cname, ccolor, cpos] of [['Todo', '#94a3b8', 0], ['In Progress', '#6366f1', 1], ['Done', '#22c55e', 2]] as const) {
    db.prepare('INSERT INTO columns (id, board_id, name, color, position) VALUES (?,?,?,?,?)').run(uuid(), boardId, cname, ccolor, cpos);
  }

  return { content: [{ type: 'text', text: JSON.stringify({ id, name, message: 'Project created with default board' }) }] };
});

// Create a task
server.tool('create_task', '创建任务', {
  project_name: z.string().optional().describe('项目名称（用于查找列，如果不提供 column_id）'),
  column_id: z.string().optional().describe('列 ID（直接指定）'),
  column_name: z.string().optional().describe('列名称（如 Todo, In Progress, Done）'),
  title: z.string().describe('任务标题'),
  description: z.string().optional().describe('任务描述'),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
  labels: z.array(z.string()).optional(),
  due_date: z.string().optional().describe('截止日期 YYYY-MM-DD'),
  parent_task_id: z.string().optional().describe('父任务 ID（用于子任务）'),
}, ({ project_name, column_id, column_name, title, description, priority, labels, due_date, parent_task_id }) => {
  const db = getDb();

  // Resolve column_id
  if (!column_id) {
    if (!project_name) return { content: [{ type: 'text', text: 'Need project_name or column_id' }], isError: true };
    const project = db.prepare('SELECT id FROM projects WHERE name = ? COLLATE NOCASE').get(project_name) as any;
    if (!project) return { content: [{ type: 'text', text: `Project "${project_name}" not found` }], isError: true };
    const board = db.prepare('SELECT id FROM boards WHERE project_id = ? ORDER BY position LIMIT 1').get(project.id) as any;
    if (!board) return { content: [{ type: 'text', text: 'No board found' }], isError: true };
    const col = db.prepare('SELECT id FROM columns WHERE board_id = ? AND name LIKE ? COLLATE NOCASE ORDER BY position LIMIT 1')
      .get(board.id, `%${column_name || 'Todo'}%`) as any;
    if (!col) return { content: [{ type: 'text', text: `Column "${column_name || 'Todo'}" not found` }], isError: true };
    column_id = col.id;
  }

  const id = uuid();
  const maxPos = (db.prepare('SELECT MAX(position) as m FROM tasks WHERE column_id = ?').get(column_id) as any)?.m ?? -1;
  db.prepare('INSERT INTO tasks (id, column_id, parent_task_id, title, description, priority, labels, due_date, position) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, column_id, parent_task_id || null, title, description || '', priority || 'medium', JSON.stringify(labels || []), due_date || null, maxPos + 1);

  return { content: [{ type: 'text', text: JSON.stringify({ id, title, column_id, message: 'Task created' }) }] };
});

// Update task (progress, status, etc.)
server.tool('update_task', '更新任务（进度、状态、描述等）', {
  task_id: z.string().describe('任务 ID'),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
  progress: z.number().min(0).max(100).optional(),
  labels: z.array(z.string()).optional(),
  due_date: z.string().nullable().optional(),
  column_name: z.string().optional().describe('移动到指定列（如 Done）'),
}, ({ task_id, title, description, priority, progress, labels, due_date, column_name }) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task_id) as any;
  if (!existing) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };

  let newColumnId = existing.column_id;
  if (column_name) {
    // Find the column in the same board
    const currentCol = db.prepare('SELECT board_id FROM columns WHERE id = ?').get(existing.column_id) as any;
    const targetCol = db.prepare('SELECT id FROM columns WHERE board_id = ? AND name LIKE ? COLLATE NOCASE LIMIT 1')
      .get(currentCol.board_id, `%${column_name}%`) as any;
    if (targetCol) newColumnId = targetCol.id;
  }

  db.prepare('UPDATE tasks SET title=?, description=?, priority=?, progress=?, labels=?, due_date=?, column_id=?, updated_at=datetime(\'now\') WHERE id=?')
    .run(title ?? existing.title, description ?? existing.description, priority ?? existing.priority,
      progress ?? existing.progress, labels ? JSON.stringify(labels) : existing.labels,
      due_date !== undefined ? due_date : existing.due_date, newColumnId, task_id);

  return { content: [{ type: 'text', text: JSON.stringify({ task_id, message: 'Task updated' }) }] };
});

// Record a quick note / idea
server.tool('record_note', '记录灵感、想法或备忘', {
  content: z.string().describe('记录内容'),
  project_name: z.string().optional().describe('关联项目名称'),
}, ({ content, project_name }) => {
  const db = getDb();
  let projectId = null;
  if (project_name) {
    const p = db.prepare('SELECT id FROM projects WHERE name = ? COLLATE NOCASE').get(project_name) as any;
    if (p) projectId = p.id;
  }
  const id = uuid();
  db.prepare('INSERT INTO quick_notes (id, content, project_id) VALUES (?,?,?)').run(id, content, projectId);
  return { content: [{ type: 'text', text: JSON.stringify({ id, message: 'Note recorded' }) }] };
});

// Get overview / dashboard
server.tool('get_overview', '获取全局概览：任务统计、逾期、项目进度、未处理记录', {}, () => {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE parent_task_id IS NULL').get() as any).c;
  const inProgress = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id WHERE t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%progress%' OR LOWER(c.name) LIKE '%doing%')").get() as any).c;
  const done = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id WHERE t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%done%' OR LOWER(c.name) LIKE '%完成%')").get() as any).c;
  const overdue = db.prepare("SELECT t.id, t.title, t.due_date, t.priority FROM tasks t WHERE t.due_date IS NOT NULL AND t.due_date < date('now') AND t.parent_task_id IS NULL LIMIT 10").all();
  const pendingNotes = db.prepare('SELECT id, content, created_at FROM quick_notes WHERE is_converted = 0 ORDER BY pinned DESC, created_at DESC LIMIT 20').all();
  const projects = db.prepare('SELECT id, name, color FROM projects WHERE archived = 0 ORDER BY position').all() as any[];
  const summaries = projects.map(p => {
    const tc = (db.prepare('SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL').get(p.id) as any).c;
    const dc = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%done%' OR LOWER(c.name) LIKE '%完成%')").get(p.id) as any).c;
    return { ...p, total_tasks: tc, done_tasks: dc };
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ total_tasks: total, in_progress: inProgress, done, todo: total - inProgress - done, overdue_tasks: overdue, project_summaries: summaries, pending_notes: pendingNotes }, null, 2),
    }],
  };
});

// List tasks for a project
server.tool('list_tasks', '列出项目的所有任务', {
  project_name: z.string().describe('项目名称'),
  status: z.string().optional().describe('筛选列名（如 Todo, In Progress, Done）'),
}, ({ project_name, status }) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE name = ? COLLATE NOCASE').get(project_name) as any;
  if (!project) return { content: [{ type: 'text', text: `Project "${project_name}" not found` }], isError: true };

  let sql = 'SELECT t.id, t.title, t.priority, t.progress, t.due_date, t.labels, c.name as column_name FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL';
  const params: any[] = [project.id];

  if (status) {
    sql += ' AND LOWER(c.name) LIKE ?';
    params.push(`%${status.toLowerCase()}%`);
  }

  sql += ' ORDER BY c.position, t.position';
  return { content: [{ type: 'text', text: JSON.stringify(db.prepare(sql).all(...params), null, 2) }] };
});

// Search across tasks and notes
server.tool('search', '搜索任务和记录', {
  query: z.string().describe('搜索关键词'),
}, ({ query }) => {
  const db = getDb();
  const pattern = `%${query}%`;
  const tasks = db.prepare('SELECT id, title, description, priority, progress FROM tasks WHERE title LIKE ? OR description LIKE ? LIMIT 20').all(pattern, pattern);
  const notes = db.prepare('SELECT id, content, created_at FROM quick_notes WHERE content LIKE ? AND is_converted = 0 LIMIT 20').all(pattern);
  return { content: [{ type: 'text', text: JSON.stringify({ tasks, notes }, null, 2) }] };
});

function parseGithubUrl(url: string): [string | null, string | null] {
  const p = url.replace(/^https?:\/\//, '').replace('github.com/', '').replace(/\/$/, '');
  const parts = p.split('/');
  return parts.length >= 2 ? [parts[0], parts[1]] : [null, null];
}

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FlowMark MCP server running');
}

main().catch(console.error);
