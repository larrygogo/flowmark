import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { getDb, runMigrations } from './db.js';

const KB_ROOT = process.argv[2] || path.join(process.env.HOME || '', 'repos', 'ming-document');

runMigrations();
const db = getDb();

// Collect all markdown files
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

console.log(`Found ${files.length} markdown files in ${KB_ROOT}`);

// Derive categories from top-level directory names
const categoryMap = new Map<string, string>(); // name -> id
const ensureCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name, position) VALUES (?, ?, ?)');
const insertDoc = db.prepare(
  'INSERT OR IGNORE INTO documents (id, category_id, title, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime(?), datetime(?))'
);

let imported = 0;
const tx = db.transaction(() => {
  for (const { relPath, fullPath } of files) {
    if (relPath === 'CLAUDE.md') continue; // skip project config

    const parts = relPath.split(path.sep);
    const categoryName = parts.length > 1 ? parts[0] : 'uncategorized';

    if (!categoryMap.has(categoryName)) {
      const catId = uuid();
      ensureCategory.run(catId, categoryName, categoryMap.size);
      categoryMap.set(categoryName, catId);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const title = path.basename(relPath, '.md');
    const stat = fs.statSync(fullPath);
    const catId = categoryMap.get(categoryName)!;

    insertDoc.run(uuid(), catId, title, content, 'published', stat.birthtime.toISOString(), stat.mtime.toISOString());
    imported++;
  }
});

tx();
console.log(`Imported ${imported} documents into ${categoryMap.size} categories`);
console.log('Categories:', [...categoryMap.keys()].join(', '));
