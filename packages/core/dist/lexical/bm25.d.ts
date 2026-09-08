import { SkillMetadata } from '../types.js';
export interface BM25Document {
    id: string;
    skill: SkillMetadata;
    nameTokens: string[];
    keywordTokens: string[];
    descTokens: string[];
    bodyTokens: string[];
    allWeightedTokens: Map<string, number>;
    totalTokens: number;
}
export interface BM25ScoreResult {
    skill: SkillMetadata;
    rawScore: number;
    normalizedScore: number;
    matchedTokens: string[];
    directMatchedTokens?: string[];
    expandedMatchedTokens?: string[];
}
export declare class BM25Engine {
    private k1;
    private b;
    private documents;
    private docFreqs;
    private idfCache;
    private avgDocLength;
    constructor(options?: {
        k1?: number;
        b?: number;
    });
    index(skills: SkillMetadata[]): void;
    search(query: string): BM25ScoreResult[];
}
//# sourceMappingURL=bm25.d.ts.map