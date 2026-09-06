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
    static HALF_LIFE_DAYS = 21;
    static HALF_LIFE_MS = 21 * 24 * 60 * 60 * 1000;
    static DECAY_LAMBDA = Math.LN2 / (21 * 24 * 60 * 60 * 1000);
    getDecayedCount(correction, now = Date.now()) {
        const ageMs = Math.max(0, now - correction.updatedAt);
        return correction.count * Math.exp(-LearningStore.DECAY_LAMBDA * ageMs);
    }
    getPreferenceBonus(query, skillId, now = Date.now()) {
        const tokens = tokenize(query, { removeStopWords: true, minLength: 3 });
        const pattern = tokens.slice(0, 5).sort().join(' ');
        if (!pattern)
            return 0;
        const id = crypto.createHash('sha256').update(pattern).digest('hex').slice(0, 16);
        const correction = this.corrections.get(id);
        if (correction && correction.preferredSkillId === skillId) {
            const decayed = this.getDecayedCount(correction, now);
            // Dynamic history bonus: scales logarithmically from 0.0 up to 0.20 based on decayed count
            return Math.min(0.20, Math.round(0.05 * Math.log(1 + decayed) * 1000) / 1000);
        }
        return 0;
    }
    getPreferenceInfo(query, skillId, now = Date.now()) {
        const tokens = tokenize(query, { removeStopWords: true, minLength: 3 });
        const pattern = tokens.slice(0, 5).sort().join(' ');
        if (!pattern)
            return null;
        const id = crypto.createHash('sha256').update(pattern).digest('hex').slice(0, 16);
        const correction = this.corrections.get(id);
        if (correction && correction.preferredSkillId === skillId) {
            const decayed = this.getDecayedCount(correction, now);
            const bonus = Math.min(0.20, Math.round(0.05 * Math.log(1 + decayed) * 1000) / 1000);
            const daysSinceUpdate = Math.round((now - correction.updatedAt) / (24 * 60 * 60 * 1000) * 10) / 10;
            return {
                bonus,
                rawCount: correction.count,
                decayedCount: Math.round(decayed * 100) / 100,
                daysSinceUpdate,
            };
        }
        return null;
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