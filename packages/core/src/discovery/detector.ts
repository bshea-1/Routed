import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HostEnvironment } from '../types.js';
export function detectEnvironments(workspaceRoot?: string): HostEnvironment[] {
    const home = os.homedir();
    const cwd = workspaceRoot || process.cwd();
    const environments: HostEnvironment[] = [
        (() => {
            const globalSkills = path.join(home, '.gemini', 'config', 'skills');
            const globalPlugins = path.join(home, '.gemini', 'config', 'plugins');
            const builtinSkills = path.join(home, '.gemini', 'antigravity-ide', 'builtin', 'skills');
            const workspaceAgents = path.join(cwd, '.agents', 'skills');
            const geminiDir = path.join(home, '.gemini');
            const exists = fs.existsSync(geminiDir) || fs.existsSync(workspaceAgents);
            const skillPaths: string[] = [];
            if (fs.existsSync(globalSkills))
                skillPaths.push(globalSkills);
            if (fs.existsSync(globalPlugins))
                skillPaths.push(globalPlugins);
            if (fs.existsSync(builtinSkills))
                skillPaths.push(builtinSkills);
            if (fs.existsSync(workspaceAgents))
                skillPaths.push(workspaceAgents);
            return {
                id: 'antigravity' as const,
                name: 'Antigravity',
                detected: exists,
                basePath: geminiDir,
                skillPaths,
                adapterSupported: true,
            };
        })(),
        (() => {
            const claudeDir = path.join(home, '.claude');
            const claudeSkills = path.join(claudeDir, 'skills');
            const claudePlugins = path.join(claudeDir, 'plugins');
            const exists = fs.existsSync(claudeDir);
            const skillPaths: string[] = [];
            if (fs.existsSync(claudeSkills))
                skillPaths.push(claudeSkills);
            if (fs.existsSync(claudePlugins))
                skillPaths.push(claudePlugins);
            return {
                id: 'claude-code' as const,
                name: 'Claude Code',
                detected: exists,
                basePath: claudeDir,
                skillPaths,
                adapterSupported: true,
            };
        })(),
        (() => {
            const cursorDir = path.join(home, '.cursor');
            const cursorSkills = path.join(cursorDir, 'skills');
            const workspaceCursor = path.join(cwd, '.cursor', 'skills');
            const exists = fs.existsSync(cursorDir) || fs.existsSync(workspaceCursor);
            const skillPaths: string[] = [];
            if (fs.existsSync(cursorSkills))
                skillPaths.push(cursorSkills);
            if (fs.existsSync(workspaceCursor))
                skillPaths.push(workspaceCursor);
            return {
                id: 'cursor' as const,
                name: 'Cursor',
                detected: exists,
                basePath: cursorDir,
                skillPaths,
                adapterSupported: true,
            };
        })(),
        (() => {
            const codexDir = path.join(home, '.codex');
            const codexSkills = path.join(codexDir, 'skills');
            const exists = fs.existsSync(codexDir);
            const skillPaths: string[] = [];
            if (fs.existsSync(codexSkills))
                skillPaths.push(codexSkills);
            return {
                id: 'codex' as const,
                name: 'Codex',
                detected: exists,
                basePath: codexDir,
                skillPaths,
                adapterSupported: true,
            };
        })(),
        (() => {
            const geminiCliDir = path.join(home, '.gemini-cli');
            const geminiSkills = path.join(geminiCliDir, 'skills');
            const exists = fs.existsSync(geminiCliDir);
            const skillPaths: string[] = [];
            if (fs.existsSync(geminiSkills))
                skillPaths.push(geminiSkills);
            return {
                id: 'gemini' as const,
                name: 'Gemini CLI',
                detected: exists,
                basePath: geminiCliDir,
                skillPaths,
                adapterSupported: true,
            };
        })(),
        (() => {
            const homeOpenCode = path.join(home, '.opencode');
            const xdgOpenCode = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode');
            const wsOpenCode = path.join(cwd, '.opencode');
            const skillPaths: string[] = [];
            const homeSkills = path.join(homeOpenCode, 'skills');
            const xdgSkills = path.join(xdgOpenCode, 'skills');
            const wsSkills = path.join(wsOpenCode, 'skills');
            if (fs.existsSync(homeSkills))
                skillPaths.push(homeSkills);
            if (fs.existsSync(xdgSkills))
                skillPaths.push(xdgSkills);
            if (fs.existsSync(wsSkills))
                skillPaths.push(wsSkills);
            const exists = fs.existsSync(homeOpenCode) || fs.existsSync(xdgOpenCode) || fs.existsSync(wsOpenCode);
            return {
                id: 'opencode' as const,
                name: 'OpenCode',
                detected: exists,
                basePath: fs.existsSync(homeOpenCode) ? homeOpenCode : xdgOpenCode,
                skillPaths,
                adapterSupported: true,
                configSource: 'builtin' as const,
            };
        })(),
        (() => {
            const localSkills = path.join(cwd, 'skills');
            const exists = fs.existsSync(localSkills);
            const skillPaths: string[] = [];
            if (exists)
                skillPaths.push(localSkills);
            return {
                id: 'custom' as const,
                name: 'Project Workspace',
                detected: exists,
                basePath: cwd,
                skillPaths,
                adapterSupported: true,
                configSource: 'workspace' as const,
            };
        })(),
    ];
    const customEnvs = loadConfiguredEnvironments(home, cwd);
    environments.push(...customEnvs);
    return environments;
}
function loadConfiguredEnvironments(home: string, cwd: string): HostEnvironment[] {
    const custom: HostEnvironment[] = [];
    try {
        const configPath = process.env.ROUTED_CONFIG_PATH;
        if (configPath && fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.environments)) {
                for (const env of parsed.environments) {
                    if (env.id && env.name) {
                        const resolvedPaths = (env.skillPaths || []).map((p: string) => p.replace(/^~/, home).replace(/^\./, cwd));
                        custom.push({
                            id: env.id,
                            name: env.name,
                            detected: resolvedPaths.some((p: string) => fs.existsSync(p)),
                            basePath: env.basePath ? env.basePath.replace(/^~/, home) : undefined,
                            skillPaths: resolvedPaths,
                            adapterSupported: Boolean(env.adapterSupported ?? true),
                            configSource: 'user-config',
                        });
                    }
                }
            }
        }
    }
    catch {
    }
    return custom;
}
