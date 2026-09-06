import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
import { generateRouteSkillContent } from '../templates/skill-adapter-template.js';
export class ClaudeCodeAdapter implements HostAdapter {
    public id = 'claude-code' as const;
    public name = 'Claude Code';
    private getAdapterDir(): string {
        return path.join(os.homedir(), '.claude', 'skills', 'route');
    }
    private getSkillFilePath(): string {
        return path.join(this.getAdapterDir(), 'SKILL.md');
    }
    public detectHost(): boolean {
        const claudeDir = path.join(os.homedir(), '.claude');
        return fs.existsSync(claudeDir);
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
                message: 'Successfully installed /route adapter for Claude Code.',
            };
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: skillPath,
                message: `Failed to install Claude Code adapter: ${err instanceof Error ? err.message : String(err)}`,
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
                message: 'Successfully removed /route adapter from Claude Code. All user skills remain untouched.',
            };
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: skillPath,
                message: `Failed to uninstall Claude Code adapter: ${err instanceof Error ? err.message : String(err)}`,
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
