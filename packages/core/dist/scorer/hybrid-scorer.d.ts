import { RouteOptions, ScoredSkill, SkillMetadata } from '../types.js';
export interface ScoreComponents {
    semanticSimilarity: number;
    lexicalSimilarity: number;
    exactOrAlias: number;
    metadataSignal: number;
    rawBm25Score: number;
    matchedTokens: string[];
}
export interface HybridScorerConfig {
    semanticWeight: number;
    lexicalWeight: number;
    exactWeight: number;
    metadataWeight: number;
}
export declare const DEFAULT_WEIGHTS: HybridScorerConfig;
export declare class HybridScorer {
    private config;
    constructor(options?: Partial<HybridScorerConfig>);
    getConfig(): HybridScorerConfig;
    computeScore(skill: SkillMetadata, components: ScoreComponents, options?: RouteOptions): ScoredSkill;
    calculateConfidence(candidates: ScoredSkill[]): ScoredSkill[];
}
//# sourceMappingURL=hybrid-scorer.d.ts.map