import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
export function parseSkillFile(filePath, sourceHost = 'custom') {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const stats = fs.statSync(filePath);
        const fileHash = crypto.createHash('sha256').update(content).digest('hex');
        const parsed = parseSkillContent(content, filePath, sourceHost);
        if (!parsed) {
            return null;
        }
        parsed.modifiedAt = stats.mtimeMs;
        parsed.fileHash = fileHash;
        return parsed;
    }
    catch (err) {
        console.error(`[routed] Failed to parse skill file at ${filePath}:`, err);
        return null;
    }
}
export function parseSkillContent(content, filePath, sourceHost = 'custom') {
    let frontmatter = {};
    let body = content;
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
    if (match) {
        const rawYaml = match[1];
        body = match[2] || '';
        try {
            const loaded = yaml.load(rawYaml);
            if (loaded && typeof loaded === 'object') {
                frontmatter = loaded;
            }
        }
        catch {
            frontmatter = parseLooseYaml(rawYaml);
        }
    }
    const parentDirName = path.basename(path.dirname(filePath));
    let name = '';
    if (typeof frontmatter.name === 'string' && frontmatter.name.trim()) {
        name = frontmatter.name.trim();
    }
    else if (parentDirName && parentDirName !== '.' && parentDirName !== 'skills') {
        name = parentDirName;
    }
    else {
        name = path.basename(filePath, path.extname(filePath));
    }
    let description = '';
    if (typeof frontmatter.description === 'string') {
        description = frontmatter.description.trim();
    }
    else if (frontmatter.description && typeof frontmatter.description === 'object') {
        description = String(frontmatter.description);
    }
    else {
        const lines = body.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('>') && !trimmed.startsWith('```')) {
                description = trimmed.slice(0, 300);
                break;
            }
        }
    }
    const aliases = [];
    if (Array.isArray(frontmatter.aliases)) {
        for (const a of frontmatter.aliases) {
            if (typeof a === 'string' && a.trim())
                aliases.push(a.trim());
        }
    }
    else if (typeof frontmatter.aliases === 'string') {
        aliases.push(...frontmatter.aliases.split(',').map((s) => s.trim()).filter(Boolean));
    }
    const keywords = [];
    if (Array.isArray(frontmatter.keywords)) {
        for (const k of frontmatter.keywords) {
            if (typeof k === 'string' && k.trim())
                keywords.push(k.trim());
        }
    }
    else if (typeof frontmatter.keywords === 'string') {
        keywords.push(...frontmatter.keywords.split(',').map((s) => s.trim()).filter(Boolean));
    }
    const tags = [];
    if (Array.isArray(frontmatter.tags)) {
        for (const t of frontmatter.tags) {
            if (typeof t === 'string' && t.trim())
                tags.push(t.trim());
        }
    }
    else if (typeof frontmatter.tags === 'string') {
        tags.push(...frontmatter.tags.split(',').map((s) => s.trim()).filter(Boolean));
    }
    const pathHash = crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 8);
    const id = `${sourceHost}:${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}:${pathHash}`;
    const cleanBody = body
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[#*`_~]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const bodyPreview = cleanBody.slice(0, 800);
    return {
        id,
        name,
        description,
        path: filePath,
        sourceHost,
        aliases,
        keywords,
        tags,
        fileHash: '',
        modifiedAt: 0,
        bodyPreview,
        rawFrontmatter: frontmatter,
    };
}
function parseLooseYaml(yamlStr) {
    const result = {};
    const lines = yamlStr.split(/\r?\n/);
    let currentKey = '';
    let multilineBuffer = [];
    for (const line of lines) {
        const keyValMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
        if (keyValMatch) {
            if (currentKey && multilineBuffer.length > 0) {
                result[currentKey] = multilineBuffer.join(' ').trim();
                multilineBuffer = [];
            }
            const key = keyValMatch[1];
            const val = keyValMatch[2].trim();
            if (val === '>' || val === '>-' || val === '|' || val === '|-') {
                currentKey = key;
            }
            else if (val.startsWith('[') && val.endsWith(']')) {
                result[key] = val
                    .slice(1, -1)
                    .split(',')
                    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
                    .filter(Boolean);
                currentKey = '';
            }
            else {
                result[key] = val.replace(/^['"]|['"]$/g, '');
                currentKey = '';
            }
        }
        else if (currentKey && line.startsWith('  ')) {
            multilineBuffer.push(line.trim());
        }
    }
    if (currentKey && multilineBuffer.length > 0) {
        result[currentKey] = multilineBuffer.join(' ').trim();
    }
    return result;
}
//# sourceMappingURL=skill-parser.js.map