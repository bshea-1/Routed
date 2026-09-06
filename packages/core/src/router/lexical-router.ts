import { RouteOptions, RouteResult, ScoredSkill, SkillMetadata } from '../types.js';
import { BM25Engine } from '../lexical/bm25.js';
import { checkExactMatch } from '../lexical/exact.js';

const TRIVIAL_PROMPT_PATTERNS = [
    /^(rename|change)\s+(variable|function|param|class)\b/i,
    /^(fix|correct)\s+(typo|spelling)\b/i,
    /^(hello|hi|hey|thanks|thank you|ok|okay|bye)\b/i,
    /^(what is|explain)\s+(this|the)\s+(line|word|function)\b/i,
    /^(format|indent)\s+(this|the)\s+(file|code)\b/i,
];

function extractSubClauses(query: string): string[] {
    const trimmed = query.trim();
    const parts = trimmed.split(/\s+(?:and|also|plus|with|as well as|then|along with|\&|\+)\s+|[;,]+/i);
    const clauses = parts.map(p => p.trim()).filter(p => p.length > 2);
    if (clauses.length <= 1) {
        return [trimmed];
    }
    return [trimmed, ...clauses];
}

export class LexicalRouter {
    private bm25: BM25Engine;
    private skills: SkillMetadata[] = [];

    constructor(skills: SkillMetadata[] = []) {
        this.bm25 = new BM25Engine();
        if (skills.length > 0) {
            this.updateSkills(skills);
        }
    }

    public updateSkills(skills: SkillMetadata[]): void {
        this.skills = skills;
        this.bm25.index(skills);
    }

    public route(query: string, options: RouteOptions = {}): RouteResult {
        const startTime = performance.now();
        const threshold = options.threshold ?? 0.18;
        const multiSkillThreshold = options.multiSkillThreshold ?? 0.30;
        const topK = options.topK ?? 3;
        const allowNoSkill = options.allowNoSkill ?? true;
        const trimmedQuery = query.trim();

        if (allowNoSkill) {
            for (const pattern of TRIVIAL_PROMPT_PATTERNS) {
                if (pattern.test(trimmedQuery)) {
                    const duration = performance.now() - startTime;
                    return {
                        query: trimmedQuery,
                        selectedSkills: [],
                        confidence: 1.0,
                        isNoSkill: true,
                        consideredCount: this.skills.length,
                        executionTimeMs: duration,
                        explanation: options.explain
                            ? {
                                summary: 'Prompt matches common generic task where standard agent capabilities suffice without special skills.',
                                candidates: [],
                                noSkillReason: 'Generic edit / conversational query',
                            }
                            : undefined,
                    };
                }
            }
        }

        const clauses = extractSubClauses(trimmedQuery);
        const candidateMap = new Map<string, ScoredSkill>();
        const clauseTopMatches: ScoredSkill[] = [];

        for (const clause of clauses) {
            const bm25Results = this.bm25.search(clause);
            const bm25Map = new Map<string, {
                rawScore: number;
                normalizedScore: number;
                matchedTokens: string[];
            }>();
            for (const b of bm25Results) {
                bm25Map.set(b.skill.id, {
                    rawScore: b.rawScore,
                    normalizedScore: b.normalizedScore,
                    matchedTokens: b.matchedTokens,
                });
            }

            const clauseCandidates: ScoredSkill[] = [];

            for (const skill of this.skills) {
                const exact = checkExactMatch(clause, skill);
                const bm = bm25Map.get(skill.id) || { rawScore: 0, normalizedScore: 0, matchedTokens: [] };

                let compositeScore = 0;
                if (exact.isExactName && exact.exactMatchScore >= 0.9) {
                    compositeScore = exact.exactMatchScore;
                }
                else if (exact.isExactAlias && (exact.aliasMatchScore || 0) >= 0.9) {
                    compositeScore = exact.aliasMatchScore || 0;
                }
                else {
                    const exactSignal = Math.max(exact.exactMatchScore, exact.aliasMatchScore || 0);
                    compositeScore = Math.min(1.0, bm.normalizedScore * 0.70 + exactSignal * 0.30);
                }

                if (compositeScore > 0.05) {
                    const scored: ScoredSkill = {
                        skill,
                        score: Math.round(compositeScore * 1000) / 1000,
                        confidence: 0,
                        signals: {
                            exactMatch: exact.exactMatchScore,
                            aliasMatch: exact.aliasMatchScore || 0,
                            bm25Score: bm.normalizedScore,
                            rawBm25Score: bm.rawScore,
                            semanticScore: 0,
                            metadataScore: 0,
                            matchedTokens: bm.matchedTokens,
                        },
                    };
                    clauseCandidates.push(scored);
                    const existing = candidateMap.get(skill.id);
                    if (!existing || scored.score > existing.score) {
                        candidateMap.set(skill.id, scored);
                    }
                }
            }

            clauseCandidates.sort((a, b) => b.score - a.score);
            if (clauseCandidates.length > 0 && clauseCandidates[0].score >= threshold) {
                clauseTopMatches.push(clauseCandidates[0]);
            }
        }

        const scoredCandidates = Array.from(candidateMap.values());
        scoredCandidates.sort((a, b) => b.score - a.score);

        if (scoredCandidates.length > 0) {
            const top1 = scoredCandidates[0];
            const top2 = scoredCandidates.length > 1 ? scoredCandidates[1] : null;
            if (top2) {
                const margin = Math.max(0, top1.score - top2.score);
                top1.confidence = Math.min(1.0, top1.score * 0.5 + margin * 0.5);
            }
            else {
                top1.confidence = top1.score;
            }
        }

        const duration = performance.now() - startTime;
        if (scoredCandidates.length === 0 || scoredCandidates[0].score < threshold) {
            return {
                query: trimmedQuery,
                selectedSkills: [],
                confidence: scoredCandidates.length > 0 ? 0.3 : 1.0,
                isNoSkill: true,
                consideredCount: this.skills.length,
                executionTimeMs: duration,
                explanation: options.explain
                    ? {
                        summary: 'No installed skill matched query above threshold.',
                        candidates: scoredCandidates.slice(0, topK),
                        noSkillReason: 'Below confidence threshold',
                    }
                    : undefined,
            };
        }

        const selectedSkills: ScoredSkill[] = [];
        const selectedIds = new Set<string>();

        for (const match of clauseTopMatches) {
            if (!selectedIds.has(match.skill.id) && selectedSkills.length < topK) {
                selectedIds.add(match.skill.id);
                selectedSkills.push(match);
            }
        }

        for (const candidate of scoredCandidates) {
            if (selectedSkills.length >= topK) break;
            if (!selectedIds.has(candidate.skill.id)) {
                if (candidate.score >= multiSkillThreshold && candidate.score >= scoredCandidates[0].score * 0.50) {
                    selectedIds.add(candidate.skill.id);
                    selectedSkills.push(candidate);
                }
            }
        }

        if (selectedSkills.length === 0) {
            selectedSkills.push(scoredCandidates[0]);
        }

        return {
            query: trimmedQuery,
            selectedSkills,
            confidence: scoredCandidates[0].confidence,
            isNoSkill: false,
            consideredCount: this.skills.length,
            executionTimeMs: duration,
            explanation: options.explain
                ? {
                    summary: `Selected ${selectedSkills.length} skill(s) via lexical matching.`,
                    candidates: scoredCandidates.slice(0, Math.max(topK, selectedSkills.length)),
                }
                : undefined,
        };
    }
}
