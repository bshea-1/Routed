import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export class ContinueAdapter {
    id = 'continue';
    name = 'Continue.dev';
    getConfigPath() {
        return path.join(os.homedir(), '.continue', 'config.json');
    }
    detectHost() {
        const dir = path.join(os.homedir(), '.continue');
        return fs.existsSync(dir);
    }
    isAdapterInstalled() {
        const cfgPath = this.getConfigPath();
        if (fs.existsSync(cfgPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
                if (config?.mcpServers?.routed || config?.experimental?.modelContextProtocolServers?.some((s) => s.name === 'routed')) {
                    return true;
                }
            }
            catch {
                // ignore
            }
        }
        return false;
    }
    async installAdapter() {
        const cfgPath = this.getConfigPath();
        const dir = path.dirname(cfgPath);
        try {
            fs.mkdirSync(dir, { recursive: true });
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
            return {
                hostId: this.id,
                name: this.name,
                success: true,
                adapterPath: cfgPath,
                message: `Configured Routed MCP server for Continue.dev at ${cfgPath}.`,
            };
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: cfgPath,
                message: `Failed to install Continue adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    async uninstallAdapter() {
        const cfgPath = this.getConfigPath();
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
        return {
            hostId: this.id,
            name: this.name,
            success: true,
            adapterPath: cfgPath,
            message: 'Removed Routed MCP server from Continue.dev configuration.',
        };
    }
    getStatus() {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: this.getConfigPath(),
        };
    }
}
//# sourceMappingURL=continue.js.map