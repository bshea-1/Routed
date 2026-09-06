import { McpServer } from '@routed/core';

export async function runMcpServer(): Promise<void> {
    const server = new McpServer({
        version: '1.1.0',
    });
    server.startStdio();
}
