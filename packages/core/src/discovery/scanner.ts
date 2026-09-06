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
        const maxDepth = options.maxDepth ?? 5;
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
            for (const entry of entries) {
                if (entry.name.startsWith('.') && entry.name !== '.agents' && entry.name !== '.gemini' && entry.name !== '.claude') {
                    continue;
                }
                if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
                    continue;
                }
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isFile()) {
                    if (entry.name.toLowerCase() === 'skill.md') {
                        const skill = parseSkillFile(fullPath, host);
                        if (skill && skill.name.toLowerCase() !== 'route') {
                            results.push(skill);
                        }
                    }
                }
                else if (entry.isDirectory() || entry.isSymbolicLink()) {
                    if (entry.name.toLowerCase() === 'route') {
                        continue;
                    }
                    const candidateSkillFile = path.join(fullPath, 'SKILL.md');
                    if (fs.existsSync(candidateSkillFile)) {
                        const skill = parseSkillFile(candidateSkillFile, host);
                        if (skill && skill.name.toLowerCase() !== 'route') {
                            results.push(skill);
                        }
                    }
                    else {
                        results.push(...this.crawlDirectory(fullPath, host, depth + 1, maxDepth));
                    }
                }
            }
        }
        catch (err) {
        }
        return results;
    }
}
