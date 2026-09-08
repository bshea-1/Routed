import { SkillMetadata } from '../types.js';
import { tokenize, tokenizeWithProvenance } from './tokenizer.js';
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
export class BM25Engine {
    private k1: number;
    private b: number;
    private documents: BM25Document[] = [];
    private docFreqs = new Map<string, number>();
    private idfCache = new Map<string, number>();
    private avgDocLength = 0;
    constructor(options: {
        k1?: number;
        b?: number;
    } = {}) {
        this.k1 = options.k1 ?? 1.2;
        this.b = options.b ?? 0.75;
    }
    public index(skills: SkillMetadata[]): void {
        this.documents = [];
        this.docFreqs.clear();
        this.idfCache.clear();
        let totalLength = 0;
        for (const skill of skills) {
            const nameTokens = tokenize(skill.name, { minLength: 2 });
            const keywordTokens = [
                ...tokenize(skill.aliases.join(' '), { minLength: 2 }),
                ...tokenize(skill.keywords.join(' '), { minLength: 2 }),
                ...tokenize(skill.tags.join(' '), { minLength: 2 }),
            ];
            const descTokens = tokenize(skill.description, { minLength: 2 });
            const bodyTokens = tokenize(skill.bodyPreview.slice(0, 500), { minLength: 2 });
            const weightedFrequencies = new Map<string, number>();
            const addTokens = (tokens: string[], weight: number) => {
                for (const token of tokens) {
                    const current = weightedFrequencies.get(token) || 0;
                    weightedFrequencies.set(token, current + weight);
                }
            };
            addTokens(nameTokens, 3.0);
            addTokens(keywordTokens, 2.5);
            addTokens(descTokens, 1.5);
            addTokens(bodyTokens, 0.5);
            const docLength = nameTokens.length * 3.0 + keywordTokens.length * 2.5 + descTokens.length * 1.5 + bodyTokens.length * 0.5;
            totalLength += docLength;
            const uniqueInDoc = new Set([
                ...nameTokens,
                ...keywordTokens,
                ...descTokens,
                ...bodyTokens,
            ]);
            for (const token of uniqueInDoc) {
                this.docFreqs.set(token, (this.docFreqs.get(token) || 0) + 1);
            }
            this.documents.push({
                id: skill.id,
                skill,
                nameTokens,
                keywordTokens,
                descTokens,
                bodyTokens,
                allWeightedTokens: weightedFrequencies,
                totalTokens: docLength,
            });
        }
        const n = this.documents.length;
        this.avgDocLength = n > 0 ? totalLength / n : 1;
        for (const [token, df] of this.docFreqs.entries()) {
            const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
            this.idfCache.set(token, Math.max(idf, 0.1));
        }
    }
    public search(query: string): BM25ScoreResult[] {
        const { tokens: queryTokens, directTokens, expandedTokens } = tokenizeWithProvenance(query, { minLength: 2 });
        if (queryTokens.length === 0 || this.documents.length === 0) {
            return [];
        }
        const results: {
            doc: BM25Document;
            rawScore: number;
            matchedTokens: string[];
            directMatchedTokens: string[];
            expandedMatchedTokens: string[];
        }[] = [];
        let maxRawScore = 0;
        for (const doc of this.documents) {
            let score = 0;
            const matchedSet = new Set<string>();
            for (const token of queryTokens) {
                const tf = doc.allWeightedTokens.get(token) || 0;
                if (tf > 0) {
                    matchedSet.add(token);
                    const idf = this.idfCache.get(token) || 0.1;
                    const numerator = tf * (this.k1 + 1);
                    const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.totalTokens / (this.avgDocLength || 1)));
                    score += idf * (numerator / denominator);
                }
            }
            if (score > 0) {
                if (score > maxRawScore)
                    maxRawScore = score;
                const matchedTokens = Array.from(matchedSet);
                const directMatchedTokens = matchedTokens.filter(t => directTokens.includes(t));
                const expandedMatchedTokens = matchedTokens.filter(t => expandedTokens.includes(t));
                results.push({ doc, rawScore: score, matchedTokens, directMatchedTokens, expandedMatchedTokens });
            }
        }
        return results
            .map((r) => {
            const normalized = maxRawScore > 0 ? Math.min(1.0, r.rawScore / maxRawScore) : 0;
            return {
                skill: r.doc.skill,
                rawScore: r.rawScore,
                normalizedScore: normalized,
                matchedTokens: r.matchedTokens,
                directMatchedTokens: r.directMatchedTokens,
                expandedMatchedTokens: r.expandedMatchedTokens,
            };
        })
            .sort((a, b) => b.rawScore - a.rawScore);
    }
}
