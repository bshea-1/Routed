import fs from 'node:fs';
import crypto from 'node:crypto';
import { getPaths } from '../config/paths.js';
import { tokenize } from '../lexical/tokenizer.js';
export interface RoutingCorrection {
    id: string;
    pattern: string;
    preferredSkillId: string;
    count: number;
    updatedAt: number;
}
export class LearningStore {
    private storePath: string;
    private corrections: Map<string, RoutingCorrection> = new Map();
    constructor(customPath?: string) {
        const paths = getPaths();
        this.storePath = customPath || paths.learningDbPath.replace(/\.db$/, '.json');
        this.load();
    }
    private load(): void {
        if (fs.existsSync(this.storePath)) {
            try {
                const raw = fs.readFileSync(this.storePath, 'utf-8');
                const data: RoutingCorrection[] = JSON.parse(raw);
                for (const item of data) {
                    this.corrections.set(item.id, item);
                }
            }
            catch {
            }
        }
    }
    private save(): void {
        try {
            const data = Array.from(this.corrections.values());
            fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch {
        }
    }
    public recordCorrection(query: string, preferredSkillId: string): void {
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
    public static readonly HALF_LIFE_DAYS = 21;
    public static readonly HALF_LIFE_MS = 21 * 24 * 60 * 60 * 1000;
    public static readonly DECAY_LAMBDA = Math.LN2 / (21 * 24 * 60 * 60 * 1000);

    public getDecayedCount(correction: RoutingCorrection, now: number = Date.now()): number {
        const ageMs = Math.max(0, now - correction.updatedAt);
        return correction.count * Math.exp(-LearningStore.DECAY_LAMBDA * ageMs);
    }

    public getPreferenceBonus(query: string, skillId: string, now: number = Date.now()): number {
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

    public getPreferenceInfo(query: string, skillId: string, now: number = Date.now()): {
        bonus: number;
        rawCount: number;
        decayedCount: number;
        daysSinceUpdate: number;
    } | null {
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

    public clear(): number {
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
    public getCount(): number {
        return this.corrections.size;
    }
    public getAll(): RoutingCorrection[] {
        return Array.from(this.corrections.values());
    }
}
