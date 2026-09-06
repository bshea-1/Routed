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
    public getPreferenceBonus(query: string, skillId: string): number {
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
