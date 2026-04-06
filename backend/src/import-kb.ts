import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { getDb, runMigrations } from './db.js';

const KB_ROOT = process.argv[2] || path.join(process.env.HOME || '', 'repos', 'ming-document');

runMigrations();
const db = getDb();

// --- Ensure categories ---
const CATEGORIES = ['介绍', '技术', '探索', '设计', '计划', '模板', '未分类'] as const;
const categoryIds = new Map<string, string>();

for (const name of CATEGORIES) {
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as any;
  if (existing) {
    categoryIds.set(name, existing.id);
  } else {
    const id = uuid();
    db.prepare('INSERT INTO categories (id, name, position) VALUES (?,?,?)').run(id, name, categoryIds.size);
    categoryIds.set(name, id);
  }
}

// Remove old categories that are no longer needed
db.prepare("DELETE FROM categories WHERE name NOT IN ('介绍','技术','探索','设计','计划','模板','未分类')").run();

// --- Build project name lookup ---
const projectsByName = new Map<string, string>();
for (const p of db.prepare('SELECT id, name FROM projects').all() as any[]) {
  projectsByName.set(p.name.toLowerCase(), p.id);
}

// Helper to find project ID by fuzzy name
function findProject(name: string): string | null {
  const lower = name.toLowerCase();
  // Direct match
  if (projectsByName.has(lower)) return projectsByName.get(lower)!;
  // Partial match
  for (const [k, v] of projectsByName) {
    if (k.includes(lower) || lower.includes(k)) return v;
  }
  return null;
}

// --- Collect files ---
const files: { relPath: string; fullPath: string }[] = [];
function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.md')) files.push({ relPath: path.relative(KB_ROOT, full), fullPath: full });
  }
}
walk(KB_ROOT);
console.log(`Found ${files.length} markdown files`);

// --- Classify each file ---
function classify(relPath: string): { category: string; projectId: string | null } {
  const parts = relPath.split(path.sep);

  // projects/reverse-bot-rs/知识库/网站介绍/** → XBot, 介绍
  if (parts[0] === 'projects' && parts[1] === 'reverse-bot-rs') {
    const projectId = findProject('xbot');
    if (parts.includes('网站介绍')) return { category: '介绍', projectId };
    if (parts.includes('核心技术')) return { category: '技术', projectId };
    return { category: '探索', projectId };
  }

  // projects/clawmo/** → ClawMo
  if (parts[0] === 'projects' && parts[1] === 'clawmo') {
    return { category: '探索', projectId: findProject('clawmo') };
  }

  // projects/xbot-js-service/** → XBot-JS-Service
  if (parts[0] === 'projects' && parts[1] === 'xbot-js-service') {
    return { category: '探索', projectId: findProject('xbot-js-service') };
  }

  // projects/openclaw-virtual-office/** → OpenClaw
  if (parts[0] === 'projects' && parts[1]?.includes('openclaw')) {
    return { category: '探索', projectId: findProject('openclaw') };
  }

  // project/clawmo.md → ClawMo, 介绍
  if (parts[0] === 'project') {
    const fileName = path.basename(relPath, '.md');
    if (fileName === 'clawmo') return { category: '介绍', projectId: findProject('clawmo') };
    if (fileName === 'clawmo-push') return { category: '介绍', projectId: findProject('clawmo-push') };
    if (fileName === 'clawmo-relay') return { category: '介绍', projectId: findProject('clawmo-relay') };
    return { category: '介绍', projectId: null };
  }

  // design/** → 设计, linked to XBot
  if (parts[0] === 'design') {
    return { category: '设计', projectId: findProject('xbot') };
  }

  // tech/** → 技术
  if (parts[0] === 'tech') {
    const fileName = path.basename(relPath, '.md');
    if (fileName.includes('openclaw')) return { category: '技术', projectId: findProject('openclaw') };
    return { category: '技术', projectId: null };
  }

  // templates/** → 模板
  if (parts[0] === 'templates') return { category: '模板', projectId: null };

  // Root-level files
  const fileName = path.basename(relPath, '.md');
  if (fileName.includes('openclaw')) return { category: '技术', projectId: findProject('openclaw') };

  return { category: '未分类', projectId: null };
}

// --- Clear old documents and re-import ---
db.prepare('DELETE FROM documents').run();

const insertDoc = db.prepare(
  'INSERT INTO documents (id, category_id, project_id, title, content, status, created_at, updated_at) VALUES (?,?,?,?,?,?,datetime(?),datetime(?))'
);

let imported = 0;
const tx = db.transaction(() => {
  for (const { relPath, fullPath } of files) {
    if (relPath === 'CLAUDE.md') continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const title = path.basename(relPath, '.md');
    const stat = fs.statSync(fullPath);
    const { category, projectId } = classify(relPath);
    const catId = categoryIds.get(category)!;

    insertDoc.run(uuid(), catId, projectId, title, content, 'published', stat.birthtime.toISOString(), stat.mtime.toISOString());
    imported++;
  }
});
tx();

// Print summary
const summary = db.prepare(`
  SELECT c.name as category, COUNT(d.id) as cnt,
    COUNT(CASE WHEN d.project_id IS NOT NULL THEN 1 END) as with_project
  FROM documents d LEFT JOIN categories c ON d.category_id = c.id
  GROUP BY c.name ORDER BY cnt DESC
`).all() as any[];

console.log(`\nImported ${imported} documents:`);
for (const s of summary) {
  console.log(`  ${s.category}: ${s.cnt} (${s.with_project} linked to projects)`);
}

// Delete empty categories
db.prepare('DELETE FROM categories WHERE id NOT IN (SELECT DISTINCT category_id FROM documents WHERE category_id IS NOT NULL)').run();
const remaining = db.prepare('SELECT name FROM categories ORDER BY position').all() as any[];
console.log(`\nCategories: ${remaining.map((r: any) => r.name).join(', ')}`);
