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
    static readonly HALF_LIFE_DAYS = 21;
    static readonly HALF_LIFE_MS: number;
    static readonly DECAY_LAMBDA: number;
    getDecayedCount(correction: RoutingCorrection, now?: number): number;
    getPreferenceBonus(query: string, skillId: string, now?: number): number;
    getPreferenceInfo(query: string, skillId: string, now?: number): {
        bonus: number;
        rawCount: number;
        decayedCount: number;
        daysSinceUpdate: number;
    } | null;
    clear(): number;
    getCount(): number;
    getAll(): RoutingCorrection[];
}
//# sourceMappingURL=learning-store.d.ts.map