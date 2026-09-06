import { SkillMetadata } from '../types.js';
import { RoutedDatabase } from '../storage/database.js';
export interface SemanticEngineOptions {
    modelName?: string;
    cacheDir?: string;
    keepWarmMs?: number;
}
export interface SemanticMatchResult {
    skill: SkillMetadata;
    similarity: number;
}
export declare class SemanticEngine {
    private modelName;
    private cacheDir;
    private keepWarmMs;
    private pipelineInstance;
    private warmTimeout;
    private isTransformersLoaded;
    private initPromise;
    constructor(options?: SemanticEngineOptions);
    getModelName(): string;
    init(): Promise<boolean>;
    embed(text: string, isQuery?: boolean): Promise<number[]>;
    indexSkills(skills: SkillMetadata[], db: RoutedDatabase): Promise<{
        embeddedCount: number;
        reusedCount: number;
    }>;
    search(query: string, skills: SkillMetadata[], db: RoutedDatabase): Promise<SemanticMatchResult[]>;
    private prepareSkillText;
    private resetWarmTimer;
    unload(): void;
    fallbackDenseVector(text: string): number[];
}
//# sourceMappingURL=semantic-engine.d.ts.map