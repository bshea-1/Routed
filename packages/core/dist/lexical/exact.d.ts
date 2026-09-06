import { SkillMetadata } from '../types.js';
export interface ExactMatchResult {
    exactMatchScore: number;
    aliasMatchScore: number;
    matchedIdentifier?: string;
    isExactName: boolean;
    isExactAlias: boolean;
}
export declare function checkExactMatch(query: string, skill: SkillMetadata): ExactMatchResult;
//# sourceMappingURL=exact.d.ts.map