import { HostEnvironment, SkillMetadata, SkillEmbedding } from '../types.js';
export declare class RoutedDatabase {
    private db;
    private dbPath;
    private isJsonFallback;
    private jsonStore;
    constructor(customPath?: string);
    private initDatabase;
    private initTables;
    private initJsonFallback;
    private saveJsonFallback;
    setMeta(key: string, value: string): void;
    getMeta(key: string): string | null;
    upsertSkill(skill: SkillMetadata): void;
    getAllSkills(): SkillMetadata[];
    getSkillByPath(filePath: string): SkillMetadata | null;
    deleteSkillByPath(filePath: string): boolean;
    removeMissingSkills(validPaths: Set<string>): number;
    saveEnvironments(environments: HostEnvironment[]): void;
    getEnvironments(): HostEnvironment[];
    upsertEmbedding(embedding: SkillEmbedding): void;
    getEmbedding(skillId: string): SkillEmbedding | null;
    getAllEmbeddings(): SkillEmbedding[];
    removeMissingEmbeddings(validSkillIds: Set<string>): number;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map