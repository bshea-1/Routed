export declare const STOP_WORDS: Set<string>;
export declare const TECHNICAL_SYNONYMS: Record<string, string[]>;
export declare function tokenize(text: string, options?: {
    removeStopWords?: boolean;
    minLength?: number;
    expandSynonyms?: boolean;
}): string[];
export declare function generateNGrams(tokens: string[], n?: number): string[];
export declare function normalizeIdentifier(name: string): string[];
//# sourceMappingURL=tokenizer.d.ts.map