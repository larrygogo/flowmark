import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, runMigrations } from './db.js';
import { apiRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations();

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/v1', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.2.0' });
});

// Serve frontend SPA
const staticDir = process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(staticDir, { maxAge: '1h' }));
app.get('/{*path}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  res.sendFile(path.join(staticDir, 'index.html'));
});

const port = Number(process.env.PORT) || 3201;
app.listen(port, () => {
  console.log(`FlowMark listening on http://0.0.0.0:${port}`);
});
