import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { runMigrations } from './db.js';
import { createMcpServer } from './mcp-server.js';

runMigrations();

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FlowMark MCP server running (v0.3.0, stdio)');
}

main().catch(console.error);
