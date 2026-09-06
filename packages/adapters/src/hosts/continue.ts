import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';

export class ContinueAdapter implements HostAdapter {
    public id = 'continue' as const;
    public name = 'Continue.dev';

    private getConfigPath(): string {
        return path.join(os.homedir(), '.continue', 'config.json');
    }

    public detectHost(): boolean {
        const dir = path.join(os.homedir(), '.continue');
        return fs.existsSync(dir);
    }

    public isAdapterInstalled(): boolean {
        const cfgPath = this.getConfigPath();
        if (fs.existsSync(cfgPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
                if (config?.mcpServers?.routed || config?.experimental?.modelContextProtocolServers?.some((s: any) => s.name === 'routed')) {
                    return true;
                }
            } catch {
                // ignore
            }
        }
        return false;
    }

    public async installAdapter(): Promise<AdapterInstallResult> {
        const cfgPath = this.getConfigPath();
        const dir = path.dirname(cfgPath);
        try {
            fs.mkdirSync(dir, { recursive: true });
            let config: Record<string, any> = {};
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
        } catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: cfgPath,
                message: `Failed to install Continue adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    public async uninstallAdapter(): Promise<AdapterUninstallResult> {
        const cfgPath = this.getConfigPath();
        if (fs.existsSync(cfgPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
                if (config?.mcpServers?.routed) {
                    delete config.mcpServers.routed;
                    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf-8');
                }
            } catch {
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

    public getStatus(): AdapterStatus {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: this.getConfigPath(),
        };
    }
}
