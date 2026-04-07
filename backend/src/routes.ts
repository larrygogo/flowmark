import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { getDb } from './db.js';

export const apiRouter: RouterType = Router();

const jwtSecret = () => process.env.JWT_SECRET || 'dev-secret';

// --- Auth ---

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === test;
}

function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, jwtSecret());
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

apiRouter.post('/auth/setup', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as c FROM auth').get() as any;
  if (existing.c > 0) return res.status(400).json({ error: 'Already set up' });
  const hash = hashPassword(req.body.password);
  db.prepare('INSERT INTO auth (id, password_hash) VALUES (1, ?)').run(hash);
  const token = jwt.sign({ sub: 'flowmark' }, jwtSecret(), { expiresIn: '30d' });
  res.json({ token });
});

apiRouter.post('/auth/login', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT password_hash FROM auth WHERE id = 1').get() as any;
  if (!row) return res.status(400).json({ error: 'Not set up' });
  if (!verifyPassword(req.body.password, row.password_hash)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = jwt.sign({ sub: 'flowmark' }, jwtSecret(), { expiresIn: '30d' });
  res.json({ token });
});

apiRouter.get('/auth/me', authMiddleware, (_req, res) => {
  res.json({ authenticated: true });
});

// Protected routes (require JWT)
apiRouter.use(authMiddleware);

// --- Projects ---
apiRouter.get('/projects', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM projects ORDER BY position ASC').all();
  res.json(rows);
});

apiRouter.post('/projects', (req, res) => {
  const db = getDb();
  const id = uuid();
  const { name, description, github_url, color } = req.body;
  const [github_owner, github_repo] = parseGithubUrl(github_url);
  const maxPos = db.prepare('SELECT MAX(position) as m FROM projects').get() as any;
  const position = (maxPos?.m ?? -1) + 1;

  db.prepare(
    'INSERT INTO projects (id, name, description, github_url, github_owner, github_repo, color, position) VALUES (?,?,?,?,?,?,?,?)'
  ).run(id, name, description || '', github_url || null, github_owner, github_repo, color || '#6366f1', position);

  // Default board with columns
  const boardId = uuid();
  db.prepare('INSERT INTO boards (id, project_id, name, position) VALUES (?,?,?,0)').run(boardId, id, 'Default');
  const cols = [['Todo', '#94a3b8', 0], ['In Progress', '#6366f1', 1], ['Done', '#22c55e', 2]];
  for (const [cname, ccolor, cpos] of cols) {
    db.prepare('INSERT INTO columns (id, board_id, name, color, position) VALUES (?,?,?,?,?)').run(uuid(), boardId, cname, ccolor, cpos);
  }

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

apiRouter.get('/projects/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const boards = db.prepare('SELECT * FROM boards WHERE project_id = ? ORDER BY position').all(req.params.id);
  const boardsWithCols = boards.map((b: any) => ({
    ...b,
    columns: db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(b.id),
  }));
  res.json({ ...(project as any), boards: boardsWithCols });
});

apiRouter.put('/projects/:id', (req, res) => {
  const db = getDb();
  const { name, description, github_url, color, archived, group_name, tags } = req.body;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const [go, gr] = parseGithubUrl(github_url ?? existing.github_url);
  db.prepare(
    'UPDATE projects SET name=?, description=?, group_name=?, tags=?, github_url=?, github_owner=?, github_repo=?, color=?, archived=?, updated_at=datetime(\'now\') WHERE id=?'
  ).run(name ?? existing.name, description ?? existing.description, group_name ?? existing.group_name, tags ? JSON.stringify(tags) : existing.tags, github_url ?? existing.github_url, go, gr, color ?? existing.color, archived ?? existing.archived, req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

apiRouter.delete('/projects/:id', (req, res) => {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Tasks ---
apiRouter.get('/tasks', (req, res) => {
  const db = getDb();
  const { board_id, column_id, project_id } = req.query;
  let sql = 'SELECT tasks.* FROM tasks';
  const params: string[] = [];

  if (column_id) {
    sql += ' WHERE tasks.column_id = ?';
    params.push(column_id as string);
  } else if (board_id) {
    sql += ' JOIN columns ON tasks.column_id = columns.id WHERE columns.board_id = ?';
    params.push(board_id as string);
  } else if (project_id) {
    sql += ' JOIN columns ON tasks.column_id = columns.id JOIN boards ON columns.board_id = boards.id WHERE boards.project_id = ?';
    params.push(project_id as string);
  }

  sql += ' ORDER BY tasks.position ASC';
  res.json(db.prepare(sql).all(...params));
});

apiRouter.post('/tasks', (req, res) => {
  const db = getDb();
  const id = uuid();
  const { column_id, title, description, priority, labels, due_date, parent_task_id } = req.body;
  const maxPos = db.prepare('SELECT MAX(position) as m FROM tasks WHERE column_id = ?').get(column_id) as any;
  const position = (maxPos?.m ?? -1) + 1;

  db.prepare(
    'INSERT INTO tasks (id, column_id, parent_task_id, title, description, priority, labels, due_date, position) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(id, column_id, parent_task_id || null, title, description || '', priority || 'medium', JSON.stringify(labels || []), due_date || null, position);

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

apiRouter.get('/tasks/:id', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const subtasks = db.prepare('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY position').all(req.params.id);
  res.json({ task, subtasks });
});

apiRouter.put('/tasks/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { title, description, priority, progress, labels, due_date, column_id } = req.body;
  db.prepare(
    'UPDATE tasks SET title=?, description=?, priority=?, progress=?, labels=?, due_date=?, column_id=?, updated_at=datetime(\'now\') WHERE id=?'
  ).run(
    title ?? existing.title, description ?? existing.description, priority ?? existing.priority,
    progress ?? existing.progress, labels ? JSON.stringify(labels) : existing.labels,
    due_date !== undefined ? due_date : existing.due_date, column_id ?? existing.column_id, req.params.id
  );
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

apiRouter.delete('/tasks/:id', (req, res) => {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

apiRouter.put('/tasks/:id/move', (req, res) => {
  const db = getDb();
  const { column_id, position } = req.body;
  db.prepare('UPDATE tasks SET position = position + 1 WHERE column_id = ? AND position >= ?').run(column_id, position);
  db.prepare('UPDATE tasks SET column_id=?, position=?, updated_at=datetime(\'now\') WHERE id=?').run(column_id, position, req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

// --- Categories ---
apiRouter.get('/categories', (_req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT c.id, c.name, c.description, COUNT(d.id) as doc_count
    FROM categories c LEFT JOIN documents d ON d.category_id = c.id
    GROUP BY c.id ORDER BY c.position
  `).all());
});

// --- Documents ---
apiRouter.get('/documents', (req, res) => {
  const db = getDb();
  const { category, status, project_id, search, page, page_size, tags: tagsFilter } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(1, Number(page_size) || 20));
  const offset = (pageNum - 1) * size;

  let sql: string;
  let countSql: string;
  const params: any[] = [];
  const countParams: any[] = [];

  if (search && String(search).trim()) {
    const term = String(search).trim();
    // FTS5 search with snippet for matched content
    sql = `SELECT d.id, d.title, d.status, d.pinned, d.tags, c.name as category, d.project_id, p.name as project_name, d.created_at, d.updated_at,
      snippet(documents_fts, 1, '<<', '>>', '...', 32) as match_snippet
      FROM documents_fts fts
      JOIN documents d ON d.rowid = fts.rowid
      LEFT JOIN categories c ON d.category_id = c.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE documents_fts MATCH ?`;
    countSql = `SELECT COUNT(*) as c FROM documents_fts fts JOIN documents d ON d.rowid = fts.rowid LEFT JOIN categories c ON d.category_id = c.id WHERE documents_fts MATCH ?`;
    params.push(term);
    countParams.push(term);
  } else {
    sql = `SELECT d.id, d.title, d.status, d.pinned, d.tags, c.name as category, d.project_id, p.name as project_name, d.created_at, d.updated_at
      FROM documents d LEFT JOIN categories c ON d.category_id = c.id LEFT JOIN projects p ON d.project_id = p.id WHERE 1=1`;
    countSql = `SELECT COUNT(*) as c FROM documents d LEFT JOIN categories c ON d.category_id = c.id WHERE 1=1`;
  }

  if (category) {
    sql += ' AND c.name = ? COLLATE NOCASE'; params.push(category);
    countSql += ' AND c.name = ? COLLATE NOCASE'; countParams.push(category);
  }
  if (project_id) {
    sql += ' AND d.project_id = ?'; params.push(project_id);
    countSql += ' AND d.project_id = ?'; countParams.push(project_id);
  }
  if (status) {
    sql += ' AND d.status = ?'; params.push(status);
    countSql += ' AND d.status = ?'; countParams.push(status);
  }
  if (tagsFilter) {
    sql += ' AND d.tags LIKE ?'; params.push(`%${tagsFilter}%`);
    countSql += ' AND d.tags LIKE ?'; countParams.push(`%${tagsFilter}%`);
  }

  const total = (db.prepare(countSql).get(...countParams) as any).c;

  if (search && String(search).trim()) {
    sql += ' ORDER BY rank';
  } else {
    sql += ' ORDER BY d.pinned DESC, d.updated_at DESC';
  }
  sql += ' LIMIT ? OFFSET ?';
  params.push(size, offset);

  const items = db.prepare(sql).all(...params);
  res.json({ items, total, page: pageNum, page_size: size });
});

apiRouter.get('/documents/:id', (req, res) => {
  const doc = getDb().prepare('SELECT d.*, c.name as category, p.name as project_name, p.color as project_color FROM documents d LEFT JOIN categories c ON d.category_id = c.id LEFT JOIN projects p ON d.project_id = p.id WHERE d.id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

// --- Dashboard ---
apiRouter.get('/dashboard', (_req, res) => {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE parent_task_id IS NULL').get() as any).c;
  const inProgress = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id WHERE t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%progress%' OR LOWER(c.name) LIKE '%doing%')").get() as any).c;
  const done = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id WHERE t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%done%' OR LOWER(c.name) LIKE '%完成%')").get() as any).c;
  const overdue = db.prepare("SELECT t.* FROM tasks t WHERE t.due_date IS NOT NULL AND t.due_date < date('now') AND t.parent_task_id IS NULL LIMIT 10").all();
  const projects = db.prepare('SELECT * FROM projects WHERE archived = 0 ORDER BY position').all();
  const summaries = (projects as any[]).map(p => {
    const tc = (db.prepare('SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL').get(p.id) as any).c;
    const dc = (db.prepare("SELECT COUNT(*) as c FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%done%' OR LOWER(c.name) LIKE '%完成%')").get(p.id) as any).c;
    return { id: p.id, name: p.name, color: p.color, total_tasks: tc, done_tasks: dc };
  });
  const totalDocs = (db.prepare('SELECT COUNT(*) as c FROM documents').get() as any).c;
  const recentDocs = db.prepare('SELECT d.id, d.title, c.name as category, d.updated_at FROM documents d LEFT JOIN categories c ON d.category_id = c.id ORDER BY d.updated_at DESC LIMIT 5').all();
  res.json({ total_tasks: total, in_progress: inProgress, done, todo: total - inProgress - done, overdue_tasks: overdue, project_summaries: summaries, total_documents: totalDocs, recent_documents: recentDocs });
});

// --- GitHub ---
apiRouter.get('/projects/:id/github/issues', (req, res) => {
  res.json(getDb().prepare("SELECT * FROM github_cache WHERE project_id = ? AND item_type = 'issue' ORDER BY github_id DESC").all(req.params.id));
});

apiRouter.get('/projects/:id/github/pulls', (req, res) => {
  res.json(getDb().prepare("SELECT * FROM github_cache WHERE project_id = ? AND item_type = 'pull_request' ORDER BY github_id DESC").all(req.params.id));
});

apiRouter.post('/projects/:id/github/sync', async (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!project?.github_owner) return res.status(400).json({ error: 'No GitHub URL' });
  try {
    const headers: Record<string, string> = { 'User-Agent': 'FlowMark', Accept: 'application/vnd.github.v3+json' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const resp = await fetch(`https://api.github.com/repos/${project.github_owner}/${project.github_repo}/issues?state=all&per_page=100&sort=updated`, { headers });
    if (!resp.ok) return res.status(502).json({ error: `GitHub: ${resp.status}` });
    const items = await resp.json() as any[];
    const upsert = db.prepare(
      `INSERT INTO github_cache (id,project_id,item_type,github_id,title,state,author,labels,data,github_created_at,github_updated_at,synced_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(project_id,item_type,github_id) DO UPDATE SET title=excluded.title,state=excluded.state,author=excluded.author,labels=excluded.labels,data=excluded.data,synced_at=datetime('now')`
    );
    const tx = db.transaction(() => {
      for (const item of items) {
        const type = item.pull_request ? 'pull_request' : 'issue';
        upsert.run(uuid(), project.id, type, item.number, item.title, item.state, item.user?.login, JSON.stringify(item.labels?.map((l: any) => l.name) || []), JSON.stringify(item), item.created_at, item.updated_at);
      }
    });
    tx();
    res.json({ synced_count: items.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Export ---
apiRouter.get('/export', (_req, res) => {
  const db = getDb();
  const data = {
    exported_at: new Date().toISOString(),
    projects: db.prepare('SELECT * FROM projects ORDER BY position').all(),
    boards: db.prepare('SELECT * FROM boards ORDER BY project_id, position').all(),
    columns: db.prepare('SELECT * FROM columns ORDER BY board_id, position').all(),
    tasks: db.prepare('SELECT * FROM tasks ORDER BY column_id, position').all(),
    categories: db.prepare('SELECT * FROM categories ORDER BY position').all(),
    documents: db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all(),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="flowmark-export.json"');
  res.json(data);
});

function parseGithubUrl(url?: string | null): [string | null, string | null] {
  if (!url) return [null, null];
  const p = url.replace(/^https?:\/\//, '').replace('github.com/', '').replace(/\/$/, '');
  const parts = p.split('/');
  return parts.length >= 2 ? [parts[0], parts[1]] : [null, null];
}
