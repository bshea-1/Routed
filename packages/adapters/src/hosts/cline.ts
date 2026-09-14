import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
import { generateRouteSkillContent } from '../templates/skill-adapter-template.js';

export class ClineAdapter implements HostAdapter {
    public id = 'cline' as const;
    public name = 'Cline';

    private getSupportedEditorNames(): string[] {
        return [
            'Antigravity IDE',
            'Antigravity',
            'Code',
            'Code - Insiders',
            'Cursor',
            'VSCodium',
            'Windsurf',
            'Gemini',
            'Positron',
            'Trae',
        ];
    }

    private getPrimaryMcpSettingsPath(): string {
        const home = os.homedir();
        // Prefer existing active globalStorage directories if any
        const existing = this.getAllCandidateMcpPaths().find((p) => fs.existsSync(path.dirname(p)));
        if (existing) {
            return existing;
        }

        if (process.platform === 'darwin') {
            const antigravityDir = path.join(home, 'Library', 'Application Support', 'Antigravity IDE', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings');
            if (fs.existsSync(path.dirname(antigravityDir))) {
                return path.join(antigravityDir, 'cline_mcp_settings.json');
            }
            return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
        }
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            return path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
        }
        return path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
    }

    private getAllCandidateMcpPaths(): string[] {
        const home = os.homedir();
        const paths: string[] = [];
        const editors = this.getSupportedEditorNames();

        if (process.platform === 'darwin') {
            const appSupport = path.join(home, 'Library', 'Application Support');
            for (const ed of editors) {
                paths.push(path.join(appSupport, ed, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
            }
            // Dynamic scan of Application Support for any saoudrizwan.claude-dev
            try {
                if (fs.existsSync(appSupport)) {
                    const entries = fs.readdirSync(appSupport, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const candidate = path.join(appSupport, entry.name, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
                            if (!paths.includes(candidate)) {
                                paths.push(candidate);
                            }
                        }
                    }
                }
            } catch {
                // ignore
            }
        } else if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            for (const ed of editors) {
                paths.push(path.join(appData, ed, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
            }
        } else {
            const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
            for (const ed of editors) {
                paths.push(path.join(configDir, ed, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'));
            }
        }

        // Standalone / workspace fallback
        paths.push(path.join(home, '.cline', 'cline_mcp_settings.json'));
        paths.push(path.join(home, '.cline', 'mcp_settings.json'));

        return paths;
    }

    private getGlobalWorkflowPath(): string {
        return path.join(os.homedir(), '.cline', 'workflows', 'route.md');
    }

    private getWorkspaceWorkflowPath(): string {
        return path.join(process.cwd(), '.cline', 'workflows', 'route.md');
    }

    private getGlobalClineRulesPath(): string {
        return path.join(os.homedir(), '.clinerules');
    }

    private getSkillDirPath(): string {
        return path.join(os.homedir(), '.cline', 'skills', 'route');
    }

    private getSkillFilePath(): string {
        return path.join(this.getSkillDirPath(), 'SKILL.md');
    }

    private generateWorkflowContent(): string {
        return `---
description: Universal local skill routing via Routed. Matches prompts to the best Agent Skills with zero LLM context tokens.
---

# Route Skill Workflow

When this workflow is executed or when the user invokes \`/route <prompt>\`:

1. **Route the Prompt**:
   - Use the \`route_skill\` tool from the \`routed\` MCP server with the user's prompt as the \`prompt\` argument, or run:
     \`\`\`bash
     routed route --json "<USER_PROMPT>"
     \`\`\`

2. **Check Matching Skills**:
   - If no skills are needed (\`isNoSkill: true\` or \`selectedSkills\` is empty), proceed with standard task execution without extra overhead.
   - If one or more skills are returned in \`selectedSkills\`, fetch and read the \`SKILL.md\` instructions at each skill's \`path\` (or call \`get_skill\`).

3. **Execute Task with Skills**:
   - Apply the rules, workflows, and constraints described in the loaded skills to solve the user's request accurately.
`;
    }

    private generateClineRulesContent(): string {
        return `# Routed Integration for Cline

When a prompt includes \`/route <prompt>\` or asks to identify and apply matching skills:
1. Use the \`route_skill\` tool from the \`routed\` MCP server (or execute \`routed route --json "<prompt>"\`).
2. If skills are selected, read their instructions and follow their workflows.
3. If no skills are needed, proceed normally.
`;
    }

    public detectHost(): boolean {
        const home = os.homedir();
        const cwd = process.cwd();

        if (fs.existsSync(path.join(home, '.cline')) || fs.existsSync(path.join(cwd, '.cline')) || fs.existsSync(path.join(cwd, '.clinerules'))) {
            return true;
        }

        for (const candidate of this.getAllCandidateMcpPaths()) {
            const extDir = path.dirname(path.dirname(candidate)); // saoudrizwan.claude-dev
            if (fs.existsSync(extDir)) {
                return true;
            }
        }

        return false;
    }

    public isAdapterInstalled(): boolean {
        // Check workflow or skill file
        if (fs.existsSync(this.getGlobalWorkflowPath()) || fs.existsSync(this.getSkillFilePath())) {
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
                } catch {
                    // ignore parse error
                }
            }
        }

        return false;
    }

    public async installAdapter(): Promise<AdapterInstallResult> {
        const configuredPaths: string[] = [];
        const messages: string[] = [];

        // 1. Install MCP configuration into all detected/active editor globalStorage locations
        const candidatePaths = this.getAllCandidateMcpPaths();
        let configuredAnyMcp = false;

        for (const cfgPath of candidatePaths) {
            const extDir = path.dirname(path.dirname(cfgPath)); // .../saoudrizwan.claude-dev
            if (fs.existsSync(extDir) || fs.existsSync(path.dirname(cfgPath))) {
                try {
                    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
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
                        disabled: false,
                        autoApprove: ['route_skill', 'get_skill', 'list_skills'],
                    };
                    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf-8');
                    configuredPaths.push(cfgPath);
                    configuredAnyMcp = true;
                } catch (err) {
                    messages.push(`Failed to write MCP config to ${cfgPath}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }

        // If no editor storage directory was pre-existing, initialize the primary default path
        if (!configuredAnyMcp) {
            const primaryPath = this.getPrimaryMcpSettingsPath();
            try {
                fs.mkdirSync(path.dirname(primaryPath), { recursive: true });
                let config: Record<string, any> = {};
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
                    autoApprove: ['route_skill', 'get_skill', 'list_skills'],
                };
                fs.writeFileSync(primaryPath, JSON.stringify(config, null, 2), 'utf-8');
                configuredPaths.push(primaryPath);
            } catch (err) {
                messages.push(`Failed to initialize default MCP config at ${primaryPath}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // 2. Install Slash Command Workflow into ~/.cline/workflows/route.md and .cline/workflows/route.md
        const workflowContent = this.generateWorkflowContent();
        const globalWorkflowPath = this.getGlobalWorkflowPath();
        try {
            fs.mkdirSync(path.dirname(globalWorkflowPath), { recursive: true });
            fs.writeFileSync(globalWorkflowPath, workflowContent, 'utf-8');
            configuredPaths.push(globalWorkflowPath);
        } catch (err) {
            messages.push(`Failed to write global workflow: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Also add to current workspace if workspace .cline exists or if in project root
        const workspaceWorkflowPath = this.getWorkspaceWorkflowPath();
        try {
            fs.mkdirSync(path.dirname(workspaceWorkflowPath), { recursive: true });
            fs.writeFileSync(workspaceWorkflowPath, workflowContent, 'utf-8');
            configuredPaths.push(workspaceWorkflowPath);
        } catch {
            // ignore workspace write errors
        }

        // 3. Install ~/.clinerules
        const globalRulesPath = this.getGlobalClineRulesPath();
        try {
            if (!fs.existsSync(globalRulesPath)) {
                fs.writeFileSync(globalRulesPath, this.generateClineRulesContent(), 'utf-8');
            } else {
                const existing = fs.readFileSync(globalRulesPath, 'utf-8');
                if (!existing.includes('Routed Integration')) {
                    fs.appendFileSync(globalRulesPath, `\n\n${this.generateClineRulesContent()}`, 'utf-8');
                }
            }
            configuredPaths.push(globalRulesPath);
        } catch (err) {
            messages.push(`Failed to update ~/.clinerules: ${err instanceof Error ? err.message : String(err)}`);
        }

        // 4. Install /route skill adapter into ~/.cline/skills/route/SKILL.md
        const skillDir = this.getSkillDirPath();
        const skillFile = this.getSkillFilePath();
        try {
            fs.mkdirSync(skillDir, { recursive: true });
            const content = generateRouteSkillContent(this.id, this.name);
            fs.writeFileSync(skillFile, content, 'utf-8');
            configuredPaths.push(skillFile);
        } catch (err) {
            messages.push(`Failed to install skill file: ${err instanceof Error ? err.message : String(err)}`);
        }

        const primaryPath = configuredPaths[0] || this.getPrimaryMcpSettingsPath();
        return {
            hostId: this.id,
            name: this.name,
            success: true,
            adapterPath: primaryPath,
            message: `Configured Routed MCP server, /route workflow, and rules for Cline across ${configuredPaths.length} locations`,
        };
    }

    public async uninstallAdapter(): Promise<AdapterUninstallResult> {
        // 1. Remove MCP configuration
        for (const cfgPath of this.getAllCandidateMcpPaths()) {
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
        }

        // 2. Remove workflows
        const globalWorkflowPath = this.getGlobalWorkflowPath();
        if (fs.existsSync(globalWorkflowPath)) {
            try {
                fs.unlinkSync(globalWorkflowPath);
            } catch {
                // ignore
            }
        }

        // 3. Remove /route skill adapter
        const skillDir = this.getSkillDirPath();
        if (fs.existsSync(skillDir)) {
            try {
                fs.rmSync(skillDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }

        return {
            hostId: this.id,
            name: this.name,
            success: true,
            adapterPath: this.getPrimaryMcpSettingsPath(),
            message: 'Removed Routed from Cline MCP, workflows, and skill configuration.',
        };
    }

    public getStatus(): AdapterStatus {
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
