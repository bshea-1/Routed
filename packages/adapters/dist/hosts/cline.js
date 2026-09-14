import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateRouteSkillContent } from '../templates/skill-adapter-template.js';
export class ClineAdapter {
    id = 'cline';
    name = 'Cline';
    getPrimaryMcpSettingsPath() {
        const home = os.homedir();
        if (process.platform === 'darwin') {
            return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
        }
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            return path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
        }
        return path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
    }
    getAllCandidateMcpPaths() {
        const home = os.homedir();
        const paths = [];
        if (process.platform === 'darwin') {
            const appSupport = path.join(home, 'Library', 'Application Support');
            const editors = ['Code', 'Code - Insiders', 'Cursor', 'VSCodium'];
            for (const ed of editors) {
                paths.push(path.join(appSupport, ed, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
            }
        }
        else if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            const editors = ['Code', 'Code - Insiders', 'Cursor', 'VSCodium'];
            for (const ed of editors) {
                paths.push(path.join(appData, ed, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
            }
        }
        else {
            const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
            const editors = ['Code', 'Code - Insiders', 'Cursor', 'VSCodium'];
            for (const ed of editors) {
                paths.push(path.join(configDir, ed, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
            }
        }
        // Also add standalone / workspace fallback
        paths.push(path.join(home, '.cline', 'cline_mcp_settings.json'));
        paths.push(path.join(home, '.cline', 'mcp_settings.json'));
        return paths;
    }
    getSkillDirPath() {
        return path.join(os.homedir(), '.cline', 'skills', 'route');
    }
    getSkillFilePath() {
        return path.join(this.getSkillDirPath(), 'SKILL.md');
    }
    detectHost() {
        const home = os.homedir();
        const cwd = process.cwd();
        if (fs.existsSync(path.join(home, '.cline')) || fs.existsSync(path.join(cwd, '.cline')) || fs.existsSync(path.join(cwd, '.clinerules'))) {
            return true;
        }
        for (const candidate of this.getAllCandidateMcpPaths()) {
            const parentDir = path.dirname(path.dirname(candidate)); // saoudrizwan.claude-dev
            if (fs.existsSync(parentDir)) {
                return true;
            }
        }
        return false;
    }
    isAdapterInstalled() {
        // Check skill adapter
        if (fs.existsSync(this.getSkillFilePath())) {
            return true;
        }
        // Check MCP settings
        for (const cfgPath of this.getAllCandidateMcpPaths()) {
            if (fs.existsSync(cfgPath)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
                    if (parsed?.mcpServers?.routed) {
                        return true;
                    }
                }
                catch {
                    // ignore parse error
                }
            }
        }
        return false;
    }
    async installAdapter() {
        const configuredPaths = [];
        const messages = [];
        // 1. Install MCP configuration into detected/active editor globalStorage locations
        const candidatePaths = this.getAllCandidateMcpPaths();
        let configuredMcp = false;
        for (const cfgPath of candidatePaths) {
            const extDir = path.dirname(path.dirname(cfgPath)); // .../saoudrizwan.claude-dev
            if (fs.existsSync(extDir) || fs.existsSync(path.dirname(cfgPath))) {
                try {
                    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
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
                        disabled: false,
                        autoApprove: [],
                    };
                    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf-8');
                    configuredPaths.push(cfgPath);
                    configuredMcp = true;
                }
                catch (err) {
                    messages.push(`Failed to write MCP config to ${cfgPath}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }
        // If no editor storage was pre-existing, initialize the primary default path
        if (!configuredMcp) {
            const primaryPath = this.getPrimaryMcpSettingsPath();
            try {
                fs.mkdirSync(path.dirname(primaryPath), { recursive: true });
                let config = {};
                if (fs.existsSync(primaryPath)) {
                    config = JSON.parse(fs.readFileSync(primaryPath, 'utf-8'));
                }
                if (!config.mcpServers) {
                    config.mcpServers = {};
                }
                config.mcpServers.routed = {
                    command: 'routed',
                    args: ['mcp'],
                    disabled: false,
                    autoApprove: [],
                };
                fs.writeFileSync(primaryPath, JSON.stringify(config, null, 2), 'utf-8');
                configuredPaths.push(primaryPath);
            }
            catch (err) {
                messages.push(`Failed to initialize default MCP config at ${primaryPath}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        // 2. Install /route skill adapter into ~/.cline/skills/route/SKILL.md
        const skillDir = this.getSkillDirPath();
        const skillFile = this.getSkillFilePath();
        try {
            fs.mkdirSync(skillDir, { recursive: true });
            const content = generateRouteSkillContent(this.id, this.name);
            fs.writeFileSync(skillFile, content, 'utf-8');
            configuredPaths.push(skillFile);
        }
        catch (err) {
            messages.push(`Failed to install skill file: ${err instanceof Error ? err.message : String(err)}`);
        }
        const primaryPath = configuredPaths[0] || this.getPrimaryMcpSettingsPath();
        return {
            hostId: this.id,
            name: this.name,
            success: true,
            adapterPath: primaryPath,
            message: `Successfully configured Routed MCP server and /route skill for Cline at ${primaryPath}`,
        };
    }
    async uninstallAdapter() {
        // 1. Remove MCP configuration
        for (const cfgPath of this.getAllCandidateMcpPaths()) {
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
        // 2. Remove /route skill adapter
        const skillDir = this.getSkillDirPath();
        const skillFile = this.getSkillFilePath();
        if (fs.existsSync(skillDir)) {
            try {
                fs.rmSync(skillDir, { recursive: true, force: true });
            }
            catch {
                // ignore
            }
        }
        return {
            hostId: this.id,
            name: this.name,
            success: true,
            adapterPath: this.getPrimaryMcpSettingsPath(),
            message: 'Removed Routed from Cline MCP and skill configuration.',
        };
    }
    getStatus() {
        const activeMcpPath = this.getAllCandidateMcpPaths().find((p) => fs.existsSync(p)) || this.getPrimaryMcpSettingsPath();
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: activeMcpPath,
        };
    }
}
//# sourceMappingURL=cline.js.map