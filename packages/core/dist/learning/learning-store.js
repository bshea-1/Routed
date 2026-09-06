import fs from 'node:fs';
import crypto from 'node:crypto';
import { getPaths } from '../config/paths.js';
import { tokenize } from '../lexical/tokenizer.js';
export class LearningStore {
    storePath;
    corrections = new Map();
    constructor(customPath) {
        const paths = getPaths();
        this.storePath = customPath || paths.learningDbPath.replace(/\.db$/, '.json');
        this.load();
    }
    load() {
        if (fs.existsSync(this.storePath)) {
            try {
                const raw = fs.readFileSync(this.storePath, 'utf-8');
                const data = JSON.parse(raw);
                for (const item of data) {
                    this.corrections.set(item.id, item);
                }
            }
            catch {
            }
        }
    }
    save() {
        try {
            const data = Array.from(this.corrections.values());
            fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch {
        }
    }
    recordCorrection(query, preferredSkillId) {
        const tokens = tokenize(query, { removeStopWords: true, minLength: 3 });
        const pattern = tokens.slice(0, 5).sort().join(' ');
        if (!pattern)
            return;
        const id = crypto.createHash('sha256').update(pattern).digest('hex').slice(0, 16);
        const existing = this.corrections.get(id);
        if (existing && existing.preferredSkillId === preferredSkillId) {
            existing.count += 1;
            existing.updatedAt = Date.now();
        }
        else {
            this.corrections.set(id, {
                id,
                pattern,
                preferredSkillId,
                count: 1,
                updatedAt: Date.now(),
            });
        }
        this.save();
    }
    getPreferenceBonus(query, skillId) {
        const tokens = tokenize(query, { removeStopWords: true, minLength: 3 });
        const pattern = tokens.slice(0, 5).sort().join(' ');
        if (!pattern)
            return 0;
        const id = crypto.createHash('sha256').update(pattern).digest('hex').slice(0, 16);
        const correction = this.corrections.get(id);
        if (correction && correction.preferredSkillId === skillId) {
            return Math.min(0.15, 0.05 * Math.log2(correction.count + 1));
        }
        return 0;
    }
    clear() {
        const count = this.corrections.size;
        this.corrections.clear();
        if (fs.existsSync(this.storePath)) {
            try {
                fs.unlinkSync(this.storePath);
            }
            catch {
            }
        }
        return count;
    }
    getCount() {
        return this.corrections.size;
    }
    getAll() {
        return Array.from(this.corrections.values());
    }
}
//# sourceMappingURL=learning-store.js.map