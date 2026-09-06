import { HostEnvironment, SkillMetadata } from '../types.js';
import { RoutedDatabase } from '../storage/database.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
export interface SkillChangeEvent {
    type: 'added' | 'updated' | 'deleted';
    filePath: string;
    skill?: SkillMetadata;
}
export declare class SkillWatcher {
    private watchers;
    private db;
    private semantic;
    private changeListeners;
    private debounceTimers;
    constructor(db?: RoutedDatabase, semantic?: SemanticEngine);
    onChange(callback: (event: SkillChangeEvent) => void): void;
    watchEnvironments(environments: HostEnvironment[]): string[];
    handleFileChange(changedPath: string, hostId: HostEnvironment['id']): Promise<SkillChangeEvent | null>;
    private notifyListeners;
    stop(): void;
}
//# sourceMappingURL=skill-watcher.d.ts.map