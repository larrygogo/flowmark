import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { getDb, runMigrations } from './db.js';

runMigrations();

const server = new McpServer({
  name: 'flowmark',
  version: '0.3.0',
});

// ============ Projects ============

server.tool('list_projects', '列出所有项目', {}, () => {
  const rows = getDb().prepare('SELECT id, name, description, github_url, color, archived FROM projects ORDER BY position').all();
  return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
});

server.tool('get_project', '获取项目详情（含看板、列、任务数）', {
  project_id: z.string().describe('项目 ID'),
}, ({ project_id }) => {
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

server.tool('create_project', '创建新项目', {
  name: z.string(), description: z.string().optional(), github_url: z.string().optional(), color: z.string().optional(),
}, ({ name, description, github_url, color }) => {
  const db = getDb();
  const id = uuid();
  const [go, gr] = parseGithubUrl(github_url);
  const maxPos = (db.prepare('SELECT MAX(position) as m FROM projects').get() as any)?.m ?? -1;
  db.prepare('INSERT INTO projects (id, name, description, github_url, github_owner, github_repo, color, position) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, name, description || '', github_url || null, go, gr, color || '#6366f1', maxPos + 1);
  const boardId = uuid();
  db.prepare('INSERT INTO boards (id, project_id, name, position) VALUES (?,?,?,0)').run(boardId, id, 'Default');
  for (const [cn, cc, cp] of [['Todo', '#94a3b8', 0], ['In Progress', '#6366f1', 1], ['Done', '#22c55e', 2]] as const) {
    db.prepare('INSERT INTO columns (id, board_id, name, color, position) VALUES (?,?,?,?,?)').run(uuid(), boardId, cn, cc, cp);
  }
  return { content: [{ type: 'text', text: JSON.stringify({ id, name, message: 'Project created' }) }] };
});

// ============ Tasks ============

server.tool('create_task', '创建任务', {
  project_name: z.string().optional().describe('项目名称'),
  column_id: z.string().optional().describe('列 ID'),
  column_name: z.string().optional().describe('列名（如 Todo, In Progress, Done）'),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
  labels: z.array(z.string()).optional(),
  due_date: z.string().optional().describe('YYYY-MM-DD'),
  parent_task_id: z.string().optional(),
}, ({ project_name, column_id, column_name, title, description, priority, labels, due_date, parent_task_id }) => {
  const db = getDb();
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
  return { content: [{ type: 'text', text: JSON.stringify({ id, title, message: 'Task created' }) }] };
});

server.tool('update_task', '更新任务', {
  task_id: z.string(),
  title: z.string().optional(), description: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
  progress: z.number().min(0).max(100).optional(),
  labels: z.array(z.string()).optional(),
  due_date: z.string().nullable().optional(),
  column_name: z.string().optional().describe('移动到指定列'),
}, ({ task_id, title, description, priority, progress, labels, due_date, column_name }) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task_id) as any;
  if (!existing) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
  let newColumnId = existing.column_id;
  if (column_name) {
    const curCol = db.prepare('SELECT board_id FROM columns WHERE id = ?').get(existing.column_id) as any;
    const target = db.prepare('SELECT id FROM columns WHERE board_id = ? AND name LIKE ? COLLATE NOCASE LIMIT 1').get(curCol.board_id, `%${column_name}%`) as any;
    if (target) newColumnId = target.id;
  }
  db.prepare('UPDATE tasks SET title=?, description=?, priority=?, progress=?, labels=?, due_date=?, column_id=?, updated_at=datetime(\'now\') WHERE id=?')
    .run(title ?? existing.title, description ?? existing.description, priority ?? existing.priority,
      progress ?? existing.progress, labels ? JSON.stringify(labels) : existing.labels,
      due_date !== undefined ? due_date : existing.due_date, newColumnId, task_id);
  return { content: [{ type: 'text', text: JSON.stringify({ task_id, message: 'Task updated' }) }] };
});

server.tool('list_tasks', '列出项目的任务', {
  project_name: z.string(),
  status: z.string().optional().describe('筛选列名'),
}, ({ project_name, status }) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE name = ? COLLATE NOCASE').get(project_name) as any;
  if (!project) return { content: [{ type: 'text', text: `Project "${project_name}" not found` }], isError: true };
  let sql = 'SELECT t.id, t.title, t.priority, t.progress, t.due_date, t.labels, c.name as column_name FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL';
  const params: any[] = [project.id];
  if (status) { sql += ' AND LOWER(c.name) LIKE ?'; params.push(`%${status.toLowerCase()}%`); }
  sql += ' ORDER BY c.position, t.position';
  return { content: [{ type: 'text', text: JSON.stringify(db.prepare(sql).all(...params), null, 2) }] };
});

// ============ Documents (Knowledge Base) ============

server.tool('list_categories', '列出所有文档分类', {}, () => {
  const db = getDb();
  const cats = db.prepare(`
    SELECT c.id, c.name, c.description, COUNT(d.id) as doc_count
    FROM categories c LEFT JOIN documents d ON d.category_id = c.id
    GROUP BY c.id ORDER BY c.position
  `).all();
  return { content: [{ type: 'text', text: JSON.stringify(cats, null, 2) }] };
});

server.tool('list_documents', '列出文档（按分类或全部）', {
  category: z.string().optional().describe('分类名称'),
  status: z.string().optional().describe('状态筛选：draft/published/to_verify/archived'),
  limit: z.number().optional().describe('数量限制，默认 50'),
}, ({ category, status, limit }) => {
  const db = getDb();
  let sql = 'SELECT d.id, d.title, d.status, d.pinned, c.name as category, d.project_id, d.created_at, d.updated_at FROM documents d LEFT JOIN categories c ON d.category_id = c.id WHERE 1=1';
  const params: any[] = [];
  if (category) { sql += ' AND c.name = ? COLLATE NOCASE'; params.push(category); }
  if (status) { sql += ' AND d.status = ?'; params.push(status); }
  sql += ' ORDER BY d.pinned DESC, d.updated_at DESC LIMIT ?';
  params.push(limit || 50);
  return { content: [{ type: 'text', text: JSON.stringify(db.prepare(sql).all(...params), null, 2) }] };
});

server.tool('get_document', '读取文档全文', {
  doc_id: z.string().describe('文档 ID'),
}, ({ doc_id }) => {
  const db = getDb();
  const doc = db.prepare('SELECT d.*, c.name as category FROM documents d LEFT JOIN categories c ON d.category_id = c.id WHERE d.id = ?').get(doc_id);
  if (!doc) return { content: [{ type: 'text', text: 'Document not found' }], isError: true };
  return { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] };
});

server.tool('create_document', '创建文档', {
  title: z.string(),
  content: z.string().describe('Markdown 内容'),
  category: z.string().optional().describe('分类名称（不存在会自动创建）'),
  project_name: z.string().optional().describe('关联项目名称'),
  status: z.enum(['draft', 'published', 'to_verify', 'archived']).optional(),
}, ({ title, content, category, project_name, status }) => {
  const db = getDb();
  let categoryId: string | null = null;
  if (category) {
    const existing = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(category) as any;
    if (existing) {
      categoryId = existing.id;
    } else {
      categoryId = uuid();
      const maxPos = (db.prepare('SELECT MAX(position) as m FROM categories').get() as any)?.m ?? -1;
      db.prepare('INSERT INTO categories (id, name, position) VALUES (?,?,?)').run(categoryId, category, maxPos + 1);
    }
  }
  let projectId: string | null = null;
  if (project_name) {
    const p = db.prepare('SELECT id FROM projects WHERE name = ? COLLATE NOCASE').get(project_name) as any;
    if (p) projectId = p.id;
  }
  const id = uuid();
  db.prepare('INSERT INTO documents (id, category_id, project_id, title, content, status) VALUES (?,?,?,?,?,?)')
    .run(id, categoryId, projectId, title, content, status || 'published');
  return { content: [{ type: 'text', text: JSON.stringify({ id, title, message: 'Document created' }) }] };
});

server.tool('update_document', '更新文档', {
  doc_id: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'to_verify', 'archived']).optional(),
  pinned: z.boolean().optional(),
}, ({ doc_id, title, content, category, status, pinned }) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(doc_id) as any;
  if (!existing) return { content: [{ type: 'text', text: 'Document not found' }], isError: true };

  let categoryId = existing.category_id;
  if (category) {
    const cat = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(category) as any;
    if (cat) categoryId = cat.id;
    else {
      categoryId = uuid();
      db.prepare('INSERT INTO categories (id, name, position) VALUES (?,?,?)').run(categoryId, category, 0);
    }
  }

  db.prepare('UPDATE documents SET title=?, content=?, category_id=?, status=?, pinned=?, updated_at=datetime(\'now\') WHERE id=?')
    .run(title ?? existing.title, content ?? existing.content, categoryId, status ?? existing.status, pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned, doc_id);
  return { content: [{ type: 'text', text: JSON.stringify({ doc_id, message: 'Document updated' }) }] };
});

server.tool('search_documents', '搜索文档', {
  query: z.string().describe('搜索关键词'),
}, ({ query }) => {
  const db = getDb();
  const pattern = `%${query}%`;
  const docs = db.prepare(
    'SELECT d.id, d.title, d.status, c.name as category, d.updated_at FROM documents d LEFT JOIN categories c ON d.category_id = c.id WHERE d.title LIKE ? OR d.content LIKE ? ORDER BY d.updated_at DESC LIMIT 20'
  ).all(pattern, pattern);
  return { content: [{ type: 'text', text: JSON.stringify(docs, null, 2) }] };
});

// ============ Overview ============

server.tool('get_overview', '获取全局概览', {}, () => {
  const db = getDb();
  const totalTasks = (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE parent_task_id IS NULL').get() as any).c;
  const inProgress = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id WHERE t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%progress%' OR LOWER(c.name) LIKE '%doing%')").get() as any).c;
  const done = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id WHERE t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%done%' OR LOWER(c.name) LIKE '%完成%')").get() as any).c;
  const overdue = db.prepare("SELECT t.id, t.title, t.due_date, t.priority FROM tasks t WHERE t.due_date IS NOT NULL AND t.due_date < date('now') AND t.parent_task_id IS NULL LIMIT 10").all();
  const totalDocs = (db.prepare('SELECT COUNT(*) as c FROM documents').get() as any).c;
  const recentDocs = db.prepare('SELECT d.id, d.title, c.name as category, d.updated_at FROM documents d LEFT JOIN categories c ON d.category_id = c.id ORDER BY d.updated_at DESC LIMIT 5').all();
  const projects = db.prepare('SELECT id, name, color FROM projects WHERE archived = 0 ORDER BY position').all() as any[];
  const summaries = projects.map(p => {
    const tc = (db.prepare('SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL').get(p.id) as any).c;
    const dc = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%done%' OR LOWER(c.name) LIKE '%完成%')").get(p.id) as any).c;
    return { ...p, total_tasks: tc, done_tasks: dc };
  });
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ total_tasks: totalTasks, in_progress: inProgress, done, todo: totalTasks - inProgress - done, overdue_tasks: overdue, total_documents: totalDocs, recent_documents: recentDocs, project_summaries: summaries }, null, 2),
    }],
  };
});

server.tool('search', '搜索任务和文档', {
  query: z.string(),
}, ({ query }) => {
  const db = getDb();
  const pattern = `%${query}%`;
  const tasks = db.prepare('SELECT id, title, description, priority FROM tasks WHERE title LIKE ? OR description LIKE ? LIMIT 20').all(pattern, pattern);
  const docs = db.prepare('SELECT d.id, d.title, c.name as category FROM documents d LEFT JOIN categories c ON d.category_id = c.id WHERE d.title LIKE ? OR d.content LIKE ? LIMIT 20').all(pattern, pattern);
  return { content: [{ type: 'text', text: JSON.stringify({ tasks, documents: docs }, null, 2) }] };
});

function parseGithubUrl(url?: string | null): [string | null, string | null] {
  if (!url) return [null, null];
  const p = url.replace(/^https?:\/\//, '').replace('github.com/', '').replace(/\/$/, '');
  const parts = p.split('/');
  return parts.length >= 2 ? [parts[0], parts[1]] : [null, null];
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FlowMark MCP server running (v0.3.0)');
}

main().catch(console.error);
