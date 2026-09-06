import { RouteOptions, RouteSignals, ScoredSkill, SkillMetadata } from '../types.js';
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
export const DEFAULT_WEIGHTS: HybridScorerConfig = {
    semanticWeight: 0.60,
    lexicalWeight: 0.25,
    exactWeight: 0.10,
    metadataWeight: 0.05,
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
    public computeScore(skill: SkillMetadata, components: ScoreComponents, options: RouteOptions = {}): ScoredSkill {
        const sw = options.semanticWeight ?? this.config.semanticWeight;
        const lw = options.lexicalWeight ?? this.config.lexicalWeight;
        const ew = options.exactWeight ?? this.config.exactWeight;
        const mw = options.metadataWeight ?? this.config.metadataWeight;
        if (components.exactOrAlias >= 0.90) {
            const signals: RouteSignals = {
                exactMatch: components.exactOrAlias,
                aliasMatch: components.exactOrAlias,
                bm25Score: components.lexicalSimilarity,
                rawBm25Score: components.rawBm25Score,
                semanticScore: components.semanticSimilarity,
                metadataScore: components.metadataSignal,
                matchedTokens: components.matchedTokens,
            };
            return {
                skill,
                score: components.exactOrAlias,
                confidence: components.exactOrAlias,
                signals,
            };
        }
        const rawScore = components.semanticSimilarity * sw +
            components.lexicalSimilarity * lw +
            components.exactOrAlias * ew +
            components.metadataSignal * mw;
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
