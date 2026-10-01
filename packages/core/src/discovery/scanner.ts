import fs from 'node:fs';
import path from 'node:path';
import { HostEnvironment, HostId, SkillMetadata } from '../types.js';
import { parseSkillFile } from '../parser/skill-parser.js';
export interface ScannerOptions {
    maxDepth?: number;
    includeBuiltin?: boolean;
    customPaths?: {
        host: HostId;
        path: string;
    }[];
}
export class SkillScanner {
    private visitedPaths = new Set<string>();
    public scanEnvironments(environments: HostEnvironment[], options: ScannerOptions = {}): SkillMetadata[] {
        const skills: SkillMetadata[] = [];
        const maxDepth = options.maxDepth ?? 8;
        this.visitedPaths.clear();
        for (const env of environments) {
            if (!env.detected && env.skillPaths.length === 0)
                continue;
            for (const skillPath of env.skillPaths) {
                if (!fs.existsSync(skillPath))
                    continue;
                if (options.includeBuiltin === false && skillPath.includes('builtin')) {
                    continue;
                }
                const found = this.crawlDirectory(skillPath, env.id, 0, maxDepth);
                skills.push(...found);
            }
        }
        if (options.customPaths) {
            for (const custom of options.customPaths) {
                if (fs.existsSync(custom.path)) {
                    const found = this.crawlDirectory(custom.path, custom.host, 0, maxDepth);
                    skills.push(...found);
                }
            }
        }
        const seenPaths = new Set<string>();
        const uniqueSkills: SkillMetadata[] = [];
        for (const skill of skills) {
            const normalizedPath = path.resolve(skill.path);
            if (!seenPaths.has(normalizedPath)) {
                seenPaths.add(normalizedPath);
                uniqueSkills.push(skill);
            }
        }
        return uniqueSkills;
    }
    private crawlDirectory(dirPath: string, host: HostId, depth: number, maxDepth: number): SkillMetadata[] {
        if (depth > maxDepth)
            return [];
        let realPath: string;
        try {
            realPath = fs.realpathSync(dirPath);
        }
        catch {
            return [];
        }
        if (this.visitedPaths.has(realPath)) {
            return [];
        }
        this.visitedPaths.add(realPath);
        const results: SkillMetadata[] = [];
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            const allowedDotDirs = ['.agents', '.gemini', '.claude', '.cursor', '.cline', '.opencode', '.hermes', '.gemini-cli', '.codex', '.system'];
            const ignoredDirs = new Set(['node_modules', 'dist', 'build', '__pycache__', 'target', '.git']);
            for (const entry of entries) {
                if (entry.name.startsWith('.') && !allowedDotDirs.includes(entry.name)) {
                    continue;
                }
                if (ignoredDirs.has(entry.name)) {
                    continue;
                }
                const fullPath = path.join(dirPath, entry.name);
                let isDirectory = entry.isDirectory();
                let isFile = entry.isFile();
                if (entry.isSymbolicLink()) {
                    try {
                        const stat = fs.statSync(fullPath);
                        isDirectory = stat.isDirectory();
                        isFile = stat.isFile();
                    }
                    catch {
                        continue;
                    }
                }
                if (isFile) {
                    if (entry.name.toLowerCase() === 'skill.md') {
                        const skill = parseSkillFile(fullPath, host);
                        if (skill && skill.name.toLowerCase() !== 'route') {
                            results.push(skill);
                        }
                    }
                }
                else if (isDirectory) {
                    if (entry.name.toLowerCase() === 'route') {
                        continue;
                    }
                    results.push(...this.crawlDirectory(fullPath, host, depth + 1, maxDepth));
                }
            }
        }
        catch (err) {
        }
        return results;
    }
}
