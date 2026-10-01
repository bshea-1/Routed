import fs from 'node:fs';
import path from 'node:path';
import { parseSkillFile } from '../parser/skill-parser.js';
export class SkillScanner {
    visitedPaths = new Set();
    scanEnvironments(environments, options = {}) {
        const skills = [];
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
        const seenPaths = new Set();
        const uniqueSkills = [];
        for (const skill of skills) {
            const normalizedPath = path.resolve(skill.path);
            if (!seenPaths.has(normalizedPath)) {
                seenPaths.add(normalizedPath);
                uniqueSkills.push(skill);
            }
        }
        return uniqueSkills;
    }
    crawlDirectory(dirPath, host, depth, maxDepth) {
        if (depth > maxDepth)
            return [];
        let realPath;
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
        const results = [];
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
//# sourceMappingURL=scanner.js.map