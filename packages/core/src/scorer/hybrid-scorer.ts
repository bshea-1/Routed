import { RouteOptions, RouteSignals, ScoredSkill, SkillMetadata } from '../types.js';
export interface ScoreComponents {
    semanticSimilarity: number;
    lexicalSimilarity: number;
    exactOrAlias: number;
    metadataSignal: number;
    rawBm25Score: number;
    matchedTokens: string[];
    directTokens?: string[];
    expandedTokens?: string[];
    frameworkPenalty?: number;
}
export interface HybridScorerConfig {
    semanticWeight: number;
    lexicalWeight: number;
    exactWeight: number;
    metadataWeight: number;
}
export const DEFAULT_WEIGHTS: HybridScorerConfig = {
    semanticWeight: 0.45,
    lexicalWeight: 0.45,
    exactWeight: 0.10,
    metadataWeight: 0.00,
};
export class HybridScorer {
    private config: HybridScorerConfig;
    constructor(options: Partial<HybridScorerConfig> = {}) {
        this.config = {
            semanticWeight: options.semanticWeight ?? DEFAULT_WEIGHTS.semanticWeight,
            lexicalWeight: options.lexicalWeight ?? DEFAULT_WEIGHTS.lexicalWeight,
            exactWeight: options.exactWeight ?? DEFAULT_WEIGHTS.exactWeight,
            metadataWeight: options.metadataWeight ?? DEFAULT_WEIGHTS.metadataWeight,
        };
    }
    public getConfig(): HybridScorerConfig {
        return { ...this.config };
    }
    public computeScore(skill: SkillMetadata, components: ScoreComponents, options: RouteOptions = {}): ScoredSkill {
        let sw = options.semanticWeight ?? this.config.semanticWeight;
        const lw = options.lexicalWeight ?? this.config.lexicalWeight;
        const ew = options.exactWeight ?? this.config.exactWeight;
        let mw = options.metadataWeight ?? this.config.metadataWeight;
        const frameworkPenalty = components.frameworkPenalty ?? 0.0;

        // If metadata/history weight is dynamically boosted beyond baseline 0.05 (up to 0.25),
        // smoothly absorb the delta from semantic weight while keeping lexical and exact baselines steady.
        if (mw > DEFAULT_WEIGHTS.metadataWeight) {
            const extraMeta = mw - DEFAULT_WEIGHTS.metadataWeight;
            sw = Math.max(0.20, sw - extraMeta);
        }

        if (components.exactOrAlias >= 0.90) {
            const score = Math.max(0, components.exactOrAlias - frameworkPenalty);
            const signals: RouteSignals = {
                exactMatch: components.exactOrAlias,
                aliasMatch: components.exactOrAlias,
                bm25Score: components.lexicalSimilarity,
                rawBm25Score: components.rawBm25Score,
                semanticScore: components.semanticSimilarity,
                metadataScore: components.metadataSignal,
                matchedTokens: components.matchedTokens,
                directTokens: components.directTokens,
                expandedTokens: components.expandedTokens,
                frameworkPenalty,
            };
            return {
                skill,
                score,
                confidence: score,
                signals,
            };
        }
        const rawScore = components.semanticSimilarity * sw +
            components.lexicalSimilarity * lw +
            components.exactOrAlias * ew +
            components.metadataSignal * mw -
            frameworkPenalty;
        const finalScore = Math.min(1.0, Math.max(0, rawScore));
        const roundedScore = Math.round(finalScore * 1000) / 1000;
        const signals: RouteSignals = {
            exactMatch: components.exactOrAlias > 0.5 ? components.exactOrAlias : 0,
            aliasMatch: 0,
            bm25Score: components.lexicalSimilarity,
            rawBm25Score: components.rawBm25Score,
            semanticScore: components.semanticSimilarity,
            metadataScore: components.metadataSignal,
            matchedTokens: components.matchedTokens,
            directTokens: components.directTokens,
            expandedTokens: components.expandedTokens,
            frameworkPenalty,
        };
        return {
            skill,
            score: roundedScore,
            confidence: 0,
            signals,
        };
    }
    public calculateConfidence(candidates: ScoredSkill[]): ScoredSkill[] {
        if (candidates.length === 0)
            return [];
        const top1 = candidates[0];
        const top2 = candidates.length > 1 ? candidates[1] : null;
        if (!top2) {
            top1.confidence = top1.score;
            return candidates;
        }
        const margin = Math.max(0, top1.score - top2.score);
        const spreadRatio = top1.score > 0 ? margin / top1.score : 0;
        top1.confidence = Math.min(1.0, Math.round((top1.score * 0.4 + spreadRatio * 0.6) * 1000) / 1000);
        return candidates;
    }
}
