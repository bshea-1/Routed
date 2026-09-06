import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export class McpAdapter {
    id = 'mcp';
    name = 'Model Context Protocol (Universal MCP)';
    getClaudeDesktopConfigPath() {
        if (process.platform === 'win32') {
            return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
        }
        if (process.platform === 'darwin') {
            return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        }
        return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    }
    getCursorMcpConfigPath() {
        return path.join(os.homedir(), '.cursor', 'mcp.json');
    }
    getActiveConfigPaths() {
        return [this.getClaudeDesktopConfigPath(), this.getCursorMcpConfigPath()];
    }
    detectHost() {
        return this.getActiveConfigPaths().some((p) => fs.existsSync(path.dirname(p)));
    }
    isAdapterInstalled() {
        for (const cfgPath of this.getActiveConfigPaths()) {
            if (fs.existsSync(cfgPath)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
                    if (parsed?.mcpServers?.routed) {
                        return true;
                    }
                }
                catch {
                    // ignore
                }
            }
        }
        return false;
    }
    async installAdapter() {
        let updatedAny = false;
        const targetPaths = this.getActiveConfigPaths();
        const messages = [];
        for (const cfgPath of targetPaths) {
            const dir = path.dirname(cfgPath);
            if (fs.existsSync(dir)) {
                try {
                    let config = {};
                    if (fs.existsSync(cfgPath)) {
                        config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
                    }
                    if (!config.mcpServers) {
                        config.mcpServers = {};
                    }
                    config.mcpServers.routed = {
                        command: 'routed',
                        args: ['mcp'],
                    };
                    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf-8');
                    updatedAny = true;
                    messages.push(`Configured Routed MCP in ${cfgPath}`);
                }
                catch (err) {
                    messages.push(`Failed to update ${cfgPath}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }
        if (!updatedAny) {
            // Create default Claude desktop config directory if neither exists
            const defaultPath = this.getClaudeDesktopConfigPath();
            try {
                fs.mkdirSync(path.dirname(defaultPath), { recursive: true });
                const config = {
                    mcpServers: {
                        routed: {
                            command: 'routed',
                            args: ['mcp'],
                        },
                    },
                };
                fs.writeFileSync(defaultPath, JSON.stringify(config, null, 2), 'utf-8');
                return {
                    hostId: this.id,
                    name: this.name,
                    success: true,
                    adapterPath: defaultPath,
                    message: `Created default MCP configuration at ${defaultPath}`,
                };
            }
            catch (err) {
                return {
                    hostId: this.id,
                    name: this.name,
                    success: false,
                    adapterPath: defaultPath,
                    message: `Failed to install MCP adapter: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        }
        return {
            hostId: this.id,
            name: this.name,
            success: true,
            adapterPath: targetPaths.join(', '),
            message: messages.join('. '),
        };
    }
    async uninstallAdapter() {
        for (const cfgPath of this.getActiveConfigPaths()) {
            if (fs.existsSync(cfgPath)) {
                try {
                    const config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
                    if (config?.mcpServers?.routed) {
                        delete config.mcpServers.routed;
                        fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf-8');
                    }
                }
                catch {
                    // ignore
                }
            }
        }
        return {
            hostId: this.id,
            name: this.name,
            success: true,
            adapterPath: this.getActiveConfigPaths().join(', '),
            message: 'Removed Routed from MCP client configurations. User skills and tools remain untouched.',
        };
    }
    getStatus() {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: this.getActiveConfigPaths().find((p) => fs.existsSync(p)) || this.getClaudeDesktopConfigPath(),
        };
    }
}
//# sourceMappingURL=mcp.js.map