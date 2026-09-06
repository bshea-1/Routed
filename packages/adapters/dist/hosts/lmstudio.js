import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export class LmStudioAdapter {
    id = 'lmstudio';
    name = 'LM Studio';
    getCandidateDirs() {
        const home = os.homedir();
        const dirs = [
            path.join(home, '.cache', 'lm-studio'),
            path.join(home, '.lmstudio'),
        ];
        if (process.platform === 'darwin') {
            dirs.push(path.join(home, 'Library', 'Application Support', 'LM Studio'));
        }
        else if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            dirs.push(path.join(appData, 'LM Studio'));
        }
        return dirs;
    }
    getMcpConfigPath() {
        const candidate = this.getCandidateDirs().find((d) => fs.existsSync(d));
        if (candidate) {
            return path.join(candidate, 'mcp.json');
        }
        return path.join(os.homedir(), '.cache', 'lm-studio', 'mcp.json');
    }
    detectHost() {
        return this.getCandidateDirs().some((d) => fs.existsSync(d));
    }
    isAdapterInstalled() {
        const cfgPath = this.getMcpConfigPath();
        if (fs.existsSync(cfgPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
                if (config?.mcpServers?.routed) {
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
        const cfgPath = this.getMcpConfigPath();
        const cfgDir = path.dirname(cfgPath);
        try {
            fs.mkdirSync(cfgDir, { recursive: true });
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
                message: `Configured Routed MCP server for LM Studio at ${cfgPath}. Models loaded in LM Studio can now invoke Routed dynamically.`,
            };
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: cfgPath,
                message: `Failed to configure LM Studio adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    async uninstallAdapter() {
        const cfgPath = this.getMcpConfigPath();
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
            message: 'Removed Routed MCP server from LM Studio configuration.',
        };
    }
    getStatus() {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: this.getMcpConfigPath(),
        };
    }
}
//# sourceMappingURL=lmstudio.js.map