export interface RoutingCorrection {
    id: string;
    pattern: string;
    preferredSkillId: string;
    count: number;
    updatedAt: number;
}
export declare class LearningStore {
    private storePath;
    private corrections;
    constructor(customPath?: string);
    private load;
    private save;
    recordCorrection(query: string, preferredSkillId: string): void;
    getPreferenceBonus(query: string, skillId: string): number;
    clear(): number;
    getCount(): number;
    getAll(): RoutingCorrection[];
}
//# sourceMappingURL=learning-store.d.ts.map