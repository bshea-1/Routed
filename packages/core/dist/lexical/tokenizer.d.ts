export declare const STOP_WORDS: Set<string>;
export declare const TECHNICAL_SYNONYMS: Record<string, string[]>;
export interface TokenizeProvenance {
    tokens: string[];
    directTokens: string[];
    expandedTokens: string[];
}
export declare function tokenizeWithProvenance(text: string, options?: {
    removeStopWords?: boolean;
    minLength?: number;
    expandSynonyms?: boolean;
}): TokenizeProvenance;
export declare function tokenize(text: string, options?: {
    removeStopWords?: boolean;
    minLength?: number;
    expandSynonyms?: boolean;
}): string[];
export interface NegationResult {
    positiveQuery: string;
    negatedTokens: string[];
}
export declare function parseNegation(query: string): NegationResult;
export declare function generateNGrams(tokens: string[], n?: number): string[];
export declare function normalizeIdentifier(name: string): string[];
//# sourceMappingURL=tokenizer.d.ts.map