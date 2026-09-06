import fs from 'node:fs';
import path from 'node:path';
import { HostEnvironment, SkillMetadata } from '../types.js';
import { parseSkillFile } from '../parser/skill-parser.js';
import { RoutedDatabase } from '../storage/database.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
export interface SkillChangeEvent {
    type: 'added' | 'updated' | 'deleted';
    filePath: string;
    skill?: SkillMetadata;
}
export class SkillWatcher {
    private watchers: fs.FSWatcher[] = [];
    private db: RoutedDatabase;
    private semantic: SemanticEngine;
    private changeListeners: ((event: SkillChangeEvent) => void)[] = [];
    private debounceTimers = new Map<string, NodeJS.Timeout>();
    constructor(db?: RoutedDatabase, semantic?: SemanticEngine) {
        this.db = db || new RoutedDatabase();
        this.semantic = semantic || new SemanticEngine();
    }
    public onChange(callback: (event: SkillChangeEvent) => void): void {
        this.changeListeners.push(callback);
    }
    public watchEnvironments(environments: HostEnvironment[]): string[] {
        const watchedPaths: string[] = [];
        for (const env of environments) {
            if (!env.detected)
                continue;
            for (const skillDir of env.skillPaths) {
                if (!fs.existsSync(skillDir))
                    continue;
                try {
                    const watcher = fs.watch(skillDir, { recursive: true }, (_eventType, filename) => {
                        if (!filename)
                            return;
                        const fullPath = path.join(skillDir, filename.toString());
                        const existingTimer = this.debounceTimers.get(fullPath);
                        if (existingTimer)
                            clearTimeout(existingTimer);
                        this.debounceTimers.set(fullPath, setTimeout(() => {
                            this.handleFileChange(fullPath, env.id);
                            this.debounceTimers.delete(fullPath);
                        }, 250));
                    });
                    this.watchers.push(watcher);
                    watchedPaths.push(skillDir);
                }
                catch {
                }
            }
        }
        return watchedPaths;
    }
    public async handleFileChange(changedPath: string, hostId: HostEnvironment['id']): Promise<SkillChangeEvent | null> {
        const isSkillMd = path.basename(changedPath).toLowerCase() === 'skill.md';
        if (!isSkillMd)
            return null;
        if (!fs.existsSync(changedPath)) {
            const existing = this.db.getSkillByPath(changedPath);
            if (existing) {
                this.db.deleteSkillByPath(changedPath);
                const event: SkillChangeEvent = { type: 'deleted', filePath: changedPath, skill: existing };
                this.notifyListeners(event);
                return event;
            }
            return null;
        }
        const parsed = parseSkillFile(changedPath, hostId);
        if (!parsed)
            return null;
        const existing = this.db.getSkillByPath(changedPath);
        const isNew = !existing;
        const isModified = existing && existing.fileHash !== parsed.fileHash;
        if (isNew || isModified) {
            this.db.upsertSkill(parsed);
            try {
                await this.semantic.indexSkills([parsed], this.db);
            }
            catch {
            }
            const event: SkillChangeEvent = {
                type: isNew ? 'added' : 'updated',
                filePath: changedPath,
                skill: parsed,
            };
            this.notifyListeners(event);
            return event;
        }
        return null;
    }
    private notifyListeners(event: SkillChangeEvent): void {
        for (const listener of this.changeListeners) {
            try {
                listener(event);
            }
            catch {
            }
        }
    }
    public stop(): void {
        for (const w of this.watchers) {
            try {
                w.close();
            }
            catch {
            }
        }
        this.watchers = [];
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}
