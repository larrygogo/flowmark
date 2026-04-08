import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDb, runMigrations } from './db.js';
import { apiRouter, verifyApiKey } from './routes.js';
import { createMcpServer } from './mcp-server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations();

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/v1', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.3.0' });
});

// --- MCP over Streamable HTTP ---
const sessions = new Map<string, StreamableHTTPServerTransport>();

function mcpAuth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !verifyApiKey(token)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

app.post('/mcp', mcpAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && sessions.has(sessionId)) {
    transport = sessions.get(sessionId)!;
  } else if (!sessionId) {
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
  } else {
    return res.status(404).json({ error: 'Session not found' });
  }

  await transport.handleRequest(req, res, req.body);
  // Store session after handling (sessionId is set after init)
  if (transport.sessionId && !sessions.has(transport.sessionId)) {
    sessions.set(transport.sessionId, transport);
  }
});

app.get('/mcp', mcpAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  await sessions.get(sessionId)!.handleRequest(req, res);
});

app.delete('/mcp', mcpAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Serve frontend SPA
const staticDir = process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(staticDir, { maxAge: '1h' }));
app.get('/{*path}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(staticDir, 'index.html'));
});

const port = Number(process.env.PORT) || 3201;
const server = app.listen(port, () => {
  console.log(`FlowMark listening on http://0.0.0.0:${port}`);
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Prevent ESM event loop drain
const _keepAlive = setInterval(() => {}, 1 << 30);
process.on('SIGTERM', () => { clearInterval(_keepAlive); server.close(); });
process.on('beforeExit', (code) => { console.log(`beforeExit code=${code}`); });
