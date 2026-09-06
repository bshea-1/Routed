import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateRouteSkillContent } from '../templates/skill-adapter-template.js';
export class CursorAdapter {
    id = 'cursor';
    name = 'Cursor';
    getAdapterDir() {
        return path.join(os.homedir(), '.cursor', 'skills', 'route');
    }
    getSkillFilePath() {
        return path.join(this.getAdapterDir(), 'SKILL.md');
    }
    detectHost() {
        const cursorHome = path.join(os.homedir(), '.cursor');
        const wsCursor = path.join(process.cwd(), '.cursor');
        return fs.existsSync(cursorHome) || fs.existsSync(wsCursor);
    }
    isAdapterInstalled() {
        return fs.existsSync(this.getSkillFilePath());
    }
    async installAdapter() {
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
                message: 'Successfully installed /route adapter for Cursor.',
            };
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: skillPath,
                message: `Failed to install Cursor adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    async uninstallAdapter() {
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
                message: 'Successfully removed /route adapter from Cursor. All user skills remain untouched.',
            };
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: skillPath,
                message: `Failed to uninstall Cursor adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    getStatus() {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: this.getSkillFilePath(),
        };
    }
}
//# sourceMappingURL=cursor.js.map