import { McpServer } from '../../../core/dist/index.js';
import { VERSION } from '../index.js';

export async function runMcpServer(): Promise<void> {
    const server = new McpServer({
        version: VERSION,
    });
    server.startStdio();
}
