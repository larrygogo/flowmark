import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createTestDb } from './setup.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let app: any;
let request: any;

// Mock getDb before importing routes
vi.mock('../db.js', () => ({
  getDb: () => db,
  runMigrations: () => {},
}));

beforeAll(async () => {
  const supertest = await import('supertest');
  const express = await import('express');
  const { apiRouter } = await import('../routes.js');

  request = supertest.default;
  const a = express.default();
  a.use(express.default.json());
  a.use('/api/v1', apiRouter);
  app = a;
});

beforeEach(() => {
  db = createTestDb();
});

function getAuthToken(): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ sub: 'flowmark' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1d' });
}

// Helper to seed a project and return its id
function seedProject(name = 'Test Project') {
  const id = `proj-${Date.now()}`;
  db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id, name);
  const boardId = `board-${Date.now()}`;
  db.prepare('INSERT INTO boards (id, project_id, name, position) VALUES (?, ?, ?, 0)').run(boardId, id, 'Default');
  const colId = `col-${Date.now()}`;
  db.prepare('INSERT INTO columns (id, board_id, name, position) VALUES (?, ?, ?, 0)').run(colId, boardId, 'Todo');
  return { projectId: id, boardId, columnId: colId };
}

describe('Auth', () => {
  it('POST /auth/setup creates initial password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/setup')
      .send({ password: 'test123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('POST /auth/setup rejects if already set up', async () => {
    await request(app).post('/api/v1/auth/setup').send({ password: 'test123' });
    const res = await request(app).post('/api/v1/auth/setup').send({ password: 'other' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/login succeeds with correct password', async () => {
    await request(app).post('/api/v1/auth/setup').send({ password: 'test123' });
    const res = await request(app).post('/api/v1/auth/login').send({ password: 'test123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('POST /auth/login rejects wrong password', async () => {
    await request(app).post('/api/v1/auth/setup').send({ password: 'test123' });
    const res = await request(app).post('/api/v1/auth/login').send({ password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('protected routes reject without token', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });
});

describe('Folders API', () => {
  const token = () => getAuthToken();

  it('GET /projects/:id/folders returns empty list', async () => {
    const { projectId } = seedProject();
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/folders`)
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /projects/:id/folders creates folder', async () => {
    const { projectId } = seedProject();
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/folders`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Design Docs' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Design Docs');
    expect(res.body.project_id).toBe(projectId);
    expect(res.body.parent_id).toBeNull();
    expect(res.body.position).toBe(0);
  });

  it('POST creates nested folder with parent_id', async () => {
    const { projectId } = seedProject();
    const parent = await request(app)
      .post(`/api/v1/projects/${projectId}/folders`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Parent' });

    const child = await request(app)
      .post(`/api/v1/projects/${projectId}/folders`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Child', parent_id: parent.body.id });
    expect(child.body.parent_id).toBe(parent.body.id);
  });

  it('POST auto-increments position', async () => {
    const { projectId } = seedProject();
    const t = token();
    const f1 = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'A' });
    const f2 = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'B' });
    expect(f1.body.position).toBe(0);
    expect(f2.body.position).toBe(1);
  });

  it('PUT /folders/:id updates folder name', async () => {
    const { projectId } = seedProject();
    const t = token();
    const created = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'Old' });
    const res = await request(app).put(`/api/v1/folders/${created.body.id}`).set('Authorization', `Bearer ${t}`).send({ name: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New');
  });

  it('PUT /folders/:id returns 404 for missing folder', async () => {
    const res = await request(app).put('/api/v1/folders/nonexistent').set('Authorization', `Bearer ${token()}`).send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('DELETE /folders/:id deletes folder', async () => {
    const { projectId } = seedProject();
    const t = token();
    const created = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'ToDelete' });
    const res = await request(app).delete(`/api/v1/folders/${created.body.id}`).set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(200);

    const list = await request(app).get(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`);
    expect(list.body).toHaveLength(0);
  });
});

describe('Tasks - acceptance_criteria', () => {
  const token = () => getAuthToken();

  it('POST /tasks creates task with acceptance_criteria', async () => {
    const { columnId } = seedProject();
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token()}`)
      .send({ column_id: columnId, title: 'Test Task', acceptance_criteria: 'Must pass all tests' });
    expect(res.status).toBe(200);
    expect(res.body.acceptance_criteria).toBe('Must pass all tests');
  });

  it('POST /tasks defaults acceptance_criteria to empty string', async () => {
    const { columnId } = seedProject();
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token()}`)
      .send({ column_id: columnId, title: 'No AC' });
    expect(res.body.acceptance_criteria).toBe('');
  });

  it('PUT /tasks/:id updates acceptance_criteria', async () => {
    const { columnId } = seedProject();
    const t = token();
    const created = await request(app).post('/api/v1/tasks').set('Authorization', `Bearer ${t}`).send({ column_id: columnId, title: 'T' });
    const res = await request(app).put(`/api/v1/tasks/${created.body.id}`).set('Authorization', `Bearer ${t}`).send({ acceptance_criteria: 'Updated AC' });
    expect(res.body.acceptance_criteria).toBe('Updated AC');
  });
});

describe('Documents - folder_id', () => {
  const token = () => getAuthToken();

  it('POST /documents creates document with folder_id', async () => {
    const { projectId } = seedProject();
    const t = token();
    const folder = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'Docs' });
    const res = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${t}`)
      .send({ title: 'Doc in folder', project_id: projectId, folder_id: folder.body.id });
    expect(res.status).toBe(200);
    expect(res.body.folder_id).toBe(folder.body.id);
  });

  it('POST /documents defaults folder_id to null', async () => {
    const t = token();
    const res = await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'Root doc' });
    expect(res.body.folder_id).toBeNull();
  });

  it('GET /documents filters by folder_id', async () => {
    const { projectId } = seedProject();
    const t = token();
    const folder = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'F1' });

    await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'In folder', project_id: projectId, folder_id: folder.body.id });
    await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'Root', project_id: projectId });

    const res = await request(app).get(`/api/v1/documents?folder_id=${folder.body.id}`).set('Authorization', `Bearer ${t}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('In folder');
  });

  it('GET /documents filters folder_id=null for root documents', async () => {
    const { projectId } = seedProject();
    const t = token();
    const folder = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'F1' });

    await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'In folder', project_id: projectId, folder_id: folder.body.id });
    await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'Root', project_id: projectId });

    const res = await request(app).get(`/api/v1/documents?project_id=${projectId}&folder_id=null`).set('Authorization', `Bearer ${t}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Root');
  });

  it('PUT /documents/:id updates folder_id', async () => {
    const { projectId } = seedProject();
    const t = token();
    const folder = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'Target' });
    const doc = await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'Move me', project_id: projectId });

    const res = await request(app).put(`/api/v1/documents/${doc.body.id}`).set('Authorization', `Bearer ${t}`).send({ folder_id: folder.body.id });
    expect(res.body.folder_id).toBe(folder.body.id);
  });

  it('DELETE folder cascades folder_id to null on documents', async () => {
    const { projectId } = seedProject();
    const t = token();
    const folder = await request(app).post(`/api/v1/projects/${projectId}/folders`).set('Authorization', `Bearer ${t}`).send({ name: 'Temp' });
    const doc = await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'Orphan', project_id: projectId, folder_id: folder.body.id });

    await request(app).delete(`/api/v1/folders/${folder.body.id}`).set('Authorization', `Bearer ${t}`);

    const updated = await request(app).get(`/api/v1/documents/${doc.body.id}`).set('Authorization', `Bearer ${t}`);
    expect(updated.body.folder_id).toBeNull();
  });
});

describe('Documents - search & pagination', () => {
  const token = () => getAuthToken();

  it('GET /documents search with LIKE matching', async () => {
    const t = token();
    await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'Web Development Guide', content: 'Learn web dev' });
    await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'Mobile Guide', content: 'Learn mobile' });

    const res = await request(app).get('/api/v1/documents?search=web').set('Authorization', `Bearer ${t}`);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items.every((d: any) => d.title.toLowerCase().includes('web') || d.content?.toLowerCase().includes('web'))).toBe(true);
  });

  it('GET /documents pagination works', async () => {
    const t = token();
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: `Doc ${i}` });
    }
    const res = await request(app).get('/api/v1/documents?page=1&page_size=2').set('Authorization', `Bearer ${t}`);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.page_size).toBe(2);
  });

  it('GET /documents filters by tags', async () => {
    const t = token();
    await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'Tagged', tags: ['frontend'] });
    await request(app).post('/api/v1/documents').set('Authorization', `Bearer ${t}`).send({ title: 'No tag' });

    const res = await request(app).get('/api/v1/documents?tags=frontend').set('Authorization', `Bearer ${t}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Tagged');
  });
});

describe('Projects - last_activity_at sorting', () => {
  const token = () => getAuthToken();

  it('GET /projects returns projects sorted by last_activity_at', async () => {
    const t = token();
    seedProject('Old Project');

    // Create a second project via API so it gets board/columns
    const p2 = await request(app).post('/api/v1/projects').set('Authorization', `Bearer ${t}`).send({ name: 'New Project' });

    const res = await request(app).get('/api/v1/projects').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    // Most recently created should be first
    expect(res.body[0].name).toBe('New Project');
  });

  it('PUT /projects/:id updates tags as JSON', async () => {
    const { projectId } = seedProject();
    const t = token();
    const res = await request(app).put(`/api/v1/projects/${projectId}`).set('Authorization', `Bearer ${t}`).send({ tags: ['rust', 'web'] });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.tags)).toEqual(['rust', 'web']);
  });
});
