import { McpServer } from '../../../core/dist/index.js';
export async function runMcpServer() {
    const server = new McpServer({
        version: '1.2.0',
    });
    server.startStdio();
}
//# sourceMappingURL=mcp.js.map