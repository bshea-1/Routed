import { SkillMetadata } from '../types.js';
import { normalizeIdentifier } from './tokenizer.js';
export interface ExactMatchResult {
    exactMatchScore: number;
    aliasMatchScore: number;
    matchedIdentifier?: string;
    isExactName: boolean;
    isExactAlias: boolean;
}
export function checkExactMatch(query: string, skill: SkillMetadata): ExactMatchResult {
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/[\s,.;:!?]+/).filter(Boolean);
    const queryJoined = queryWords.join(' ');
    const skillNameLower = skill.name.toLowerCase().trim();
    const skillNameVariants = normalizeIdentifier(skillNameLower);
    let isExactName = false;
    let exactMatchScore = 0.0;
    if (normalizedQuery === skillNameLower || queryJoined === skillNameLower) {
        return {
            exactMatchScore: 1.0,
            aliasMatchScore: 0.0,
            matchedIdentifier: skill.name,
            isExactName: true,
            isExactAlias: false,
        };
    }
    for (const variant of skillNameVariants) {
        if (variant.length < 3)
            continue;
        const regex = new RegExp(`\\b${escapeRegExp(variant)}\\b`, 'i');
        if (regex.test(normalizedQuery)) {
            const ratio = variant.length / Math.max(normalizedQuery.length, 10);
            const score = Math.min(0.95, 0.70 + ratio * 0.25);
            if (score > exactMatchScore) {
                exactMatchScore = score;
                isExactName = true;
            }
        }
    }
    let isExactAlias = false;
    let aliasMatchScore = 0.0;
    let matchedAlias: string | undefined;
    for (const alias of skill.aliases) {
        const aliasLower = alias.toLowerCase().trim();
        if (!aliasLower)
            continue;
        if (normalizedQuery === aliasLower || queryJoined === aliasLower) {
            return {
                exactMatchScore: 0.0,
                aliasMatchScore: 1.0,
                matchedIdentifier: alias,
                isExactName: false,
                isExactAlias: true,
            };
        }
        const aliasVariants = normalizeIdentifier(aliasLower);
        for (const variant of aliasVariants) {
            if (variant.length < 3)
                continue;
            const regex = new RegExp(`\\b${escapeRegExp(variant)}\\b`, 'i');
            if (regex.test(normalizedQuery)) {
                const ratio = variant.length / Math.max(normalizedQuery.length, 10);
                const score = Math.min(0.90, 0.65 + ratio * 0.25);
                if (score > aliasMatchScore) {
                    aliasMatchScore = score;
                    isExactAlias = true;
                    matchedAlias = alias;
                }
            }
        }
    }
    return {
        exactMatchScore,
        aliasMatchScore,
        matchedIdentifier: matchedAlias || (isExactName ? skill.name : undefined),
        isExactName,
        isExactAlias,
    };
}
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
