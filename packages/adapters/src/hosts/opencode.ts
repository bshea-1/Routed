import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
import { generateRouteSkillContent } from '../templates/skill-adapter-template.js';
export class OpenCodeAdapter implements HostAdapter {
    public id = 'opencode' as const;
    public name = 'OpenCode';
    private getAdapterDir(): string {
        const home = os.homedir();
        const primaryHome = path.join(home, '.opencode');
        const xdgConfig = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode');
        if (fs.existsSync(primaryHome) || !fs.existsSync(xdgConfig)) {
            return path.join(primaryHome, 'skills', 'route');
        }
        return path.join(xdgConfig, 'skills', 'route');
    }
    private getSkillFilePath(): string {
        return path.join(this.getAdapterDir(), 'SKILL.md');
    }
    public detectHost(): boolean {
        const home = os.homedir();
        const primary = path.join(home, '.opencode');
        const xdg = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode');
        const ws = path.join(process.cwd(), '.opencode');
        return fs.existsSync(primary) || fs.existsSync(xdg) || fs.existsSync(ws);
    }
    public isAdapterInstalled(): boolean {
        return fs.existsSync(this.getSkillFilePath());
    }
    public async installAdapter(): Promise<AdapterInstallResult> {
        const adapterDir = this.getAdapterDir();
        const skillPath = this.getSkillFilePath();
        try {
            if (this.isAdapterInstalled()) {
                return {
                    hostId: this.id,
                    name: this.name,
                    success: true,
                    adapterPath: skillPath,
                    message: 'Adapter is already installed and up to date.',
                    alreadyInstalled: true,
                };
            }
            fs.mkdirSync(adapterDir, { recursive: true });
            const content = generateRouteSkillContent(this.id, this.name);
            fs.writeFileSync(skillPath, content, 'utf-8');
            return {
                hostId: this.id,
                name: this.name,
                success: true,
                adapterPath: skillPath,
                message: 'Successfully installed /route adapter for OpenCode.',
            };
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: skillPath,
                message: `Failed to install OpenCode adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    public async uninstallAdapter(): Promise<AdapterUninstallResult> {
        const adapterDir = this.getAdapterDir();
        const skillPath = this.getSkillFilePath();
        try {
            if (!this.isAdapterInstalled()) {
                return {
                    hostId: this.id,
                    name: this.name,
                    success: true,
                    adapterPath: skillPath,
                    message: 'Adapter was not installed.',
                    notInstalled: true,
                };
            }
            fs.rmSync(adapterDir, { recursive: true, force: true });
            return {
                hostId: this.id,
                name: this.name,
                success: true,
                adapterPath: skillPath,
                message: 'Successfully removed /route adapter from OpenCode. All user skills remain untouched.',
            };
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: skillPath,
                message: `Failed to uninstall OpenCode adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    public getStatus(): AdapterStatus {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: this.getSkillFilePath(),
        };
    }
}
