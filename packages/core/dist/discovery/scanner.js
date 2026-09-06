import fs from 'node:fs';
import path from 'node:path';
import { parseSkillFile } from '../parser/skill-parser.js';
export class SkillScanner {
    visitedPaths = new Set();
    scanEnvironments(environments, options = {}) {
        const skills = [];
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
//# sourceMappingURL=scanner.js.map