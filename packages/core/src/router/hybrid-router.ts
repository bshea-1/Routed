import { RouteOptions, RouteResult, ScoredSkill, SkillMetadata } from '../types.js';
import { BM25Engine } from '../lexical/bm25.js';
import { checkExactMatch } from '../lexical/exact.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
import { HybridScorer, ScoreComponents } from '../scorer/hybrid-scorer.js';
import { RoutedDatabase } from '../storage/database.js';
import { LearningStore } from '../learning/learning-store.js';

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

export class HybridRouter {
    private bm25: BM25Engine;
    private semantic: SemanticEngine;
    private scorer: HybridScorer;
    private db: RoutedDatabase;
    private learningStore?: LearningStore;
    private skills: SkillMetadata[] = [];

    constructor(skills: SkillMetadata[] = [], db?: RoutedDatabase, semantic?: SemanticEngine, learningStore?: LearningStore, scorer?: HybridScorer) {
        this.db = db || new RoutedDatabase();
        const activeWeights = this.db.getRoutingWeights();
        this.scorer = scorer || new HybridScorer(activeWeights || undefined);
        this.bm25 = new BM25Engine();
        this.semantic = semantic || new SemanticEngine();
        this.learningStore = learningStore || new LearningStore();
        if (skills.length > 0) {
            this.updateSkills(skills);
        }
    }

    public getScorer(): HybridScorer {
        return this.scorer;
    }

    public getDatabase(): RoutedDatabase {
        return this.db;
    }

    public updateSkills(skills: SkillMetadata[]): void {
        this.skills = skills;
        this.bm25.index(skills);
    }

    public async route(query: string, options: RouteOptions = {}): Promise<RouteResult> {
        const startTime = performance.now();
        const threshold = options.threshold ?? 0.20;
        const multiSkillThreshold = options.multiSkillThreshold ?? 0.30;
        const allowNoSkill = options.allowNoSkill ?? true;
        const skipSemanticIfExact = options.skipSemanticIfExact ?? true;
        const trimmedQuery = query.trim();
        const clauses = extractSubClauses(trimmedQuery);
        const topK = options.topK ?? (clauses.length > 1 ? Math.min(10, Math.max(5, clauses.length * 2)) : 5);

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

        const exactSkillsFound: ScoredSkill[] = [];
        const seenExactNames = new Set<string>();

        for (const clause of clauses) {
            for (const skill of this.skills) {
                if (skill.name.toLowerCase() === 'route') continue;
                const match = checkExactMatch(clause, skill);
                const score = Math.max(match.exactMatchScore, match.aliasMatchScore);
                const normName = skill.name.toLowerCase();
                if (score >= 0.90 && !seenExactNames.has(normName)) {
                    seenExactNames.add(normName);
                    exactSkillsFound.push({
                        skill,
                        score: score,
                        confidence: 1.0,
                        signals: {
                            exactMatch: match.exactMatchScore,
                            aliasMatch: match.aliasMatchScore,
                            bm25Score: 1.0,
                            rawBm25Score: 10.0,
                            semanticScore: 1.0,
                            metadataScore: 1.0,
                            matchedTokens: [skill.name],
                        },
                    });
                }
            }
        }

        if (skipSemanticIfExact && exactSkillsFound.length > 0 && (clauses.length > 1 || exactSkillsFound[0].score >= 0.95)) {
            const duration = performance.now() - startTime;
            const selected = exactSkillsFound.slice(0, topK);
            return {
                query: trimmedQuery,
                selectedSkills: selected,
                confidence: 1.0,
                isNoSkill: false,
                consideredCount: this.skills.length,
                executionTimeMs: duration,
                explanation: options.explain
                    ? {
                        summary: `Exact name/alias match found for ${selected.map(s => s.skill.name).join(', ')}.`,
                        candidates: selected,
                    }
                    : undefined,
            };
        }

        const candidateMap = new Map<string, ScoredSkill>();
        const clauseTopMatches: ScoredSkill[] = [];

        for (const clause of clauses) {
            const bm25Results = this.bm25.search(clause);
            const bm25Map = new Map<string, { rawScore: number; normalizedScore: number; matchedTokens: string[] }>();
            for (const b of bm25Results) {
                bm25Map.set(b.skill.id, {
                    rawScore: b.rawScore,
                    normalizedScore: b.normalizedScore,
                    matchedTokens: b.matchedTokens,
                });
            }

            const semanticResults = await this.semantic.search(clause, this.skills, this.db);
            const semanticMap = new Map<string, number>();
            for (const s of semanticResults) {
                semanticMap.set(s.skill.id, s.similarity);
            }

            const clauseCandidates: ScoredSkill[] = [];

            for (const skill of this.skills) {
                if (skill.name.toLowerCase() === 'route') continue;
                const exact = checkExactMatch(clause, skill);
                const bm = bm25Map.get(skill.id) || { rawScore: 0, normalizedScore: 0, matchedTokens: [] };
                const sem = semanticMap.get(skill.id) || 0;
                const queryLower = clause.toLowerCase();
                const metaSignal = skill.tags.some((t) => queryLower.includes(t.toLowerCase())) ||
                    skill.keywords.some((k) => queryLower.includes(k.toLowerCase())) ? 1.0 : 0.0;

                let customOptions = options;
                let prefInfo: { bonus: number; rawCount: number; decayedCount: number; daysSinceUpdate: number } | null = null;
                if (this.learningStore) {
                    prefInfo = this.learningStore.getPreferenceInfo(clause, skill.id);
                    if (prefInfo && prefInfo.bonus > 0) {
                        customOptions = {
                            ...options,
                            metadataWeight: Math.min(0.25, (options.metadataWeight ?? 0.05) + prefInfo.bonus),
                        };
                    }
                }

                const components: ScoreComponents = {
                    semanticSimilarity: sem,
                    lexicalSimilarity: bm.normalizedScore,
                    exactOrAlias: Math.max(exact.exactMatchScore, matchOrZero(exact.aliasMatchScore)),
                    metadataSignal: prefInfo && prefInfo.bonus > 0 ? 1.0 : metaSignal,
                    rawBm25Score: bm.rawScore,
                    matchedTokens: bm.matchedTokens,
                };

                let scored = this.scorer.computeScore(skill, components, customOptions);

                if (prefInfo && prefInfo.bonus > 0) {
                    scored = {
                        ...scored,
                        signals: {
                            ...scored.signals,
                            metadataScore: Math.min(1.0, scored.signals.metadataScore + prefInfo.bonus),
                            historyBonus: prefInfo.bonus,
                            decayedCount: prefInfo.decayedCount,
                        },
                    };
                }

                if (scored.score > 0.05) {
                    clauseCandidates.push(scored);
                    const normName = skill.name.toLowerCase();
                    const existing = candidateMap.get(normName);
                    if (!existing || scored.score > existing.score) {
                        candidateMap.set(normName, scored);
                    }
                }
            }

            clauseCandidates.sort((a, b) => b.score - a.score);
            if (clauseCandidates.length > 0 && clauseCandidates[0].score >= threshold) {
                clauseTopMatches.push(clauseCandidates[0]);
            }
        }

        const candidates = Array.from(candidateMap.values());
        candidates.sort((a, b) => b.score - a.score);
        this.scorer.calculateConfidence(candidates);

        const duration = performance.now() - startTime;

        if (candidates.length === 0 || candidates[0].score < threshold) {
            return {
                query: trimmedQuery,
                selectedSkills: [],
                confidence: candidates.length > 0 ? candidates[0].confidence : 1.0,
                isNoSkill: true,
                consideredCount: this.skills.length,
                executionTimeMs: duration,
                explanation: options.explain
                    ? {
                        summary: 'No skill exceeded minimum confidence threshold.',
                        candidates: candidates.slice(0, topK),
                        noSkillReason: 'Below confidence threshold',
                    }
                    : undefined,
            };
        }

        const selectedSkills: ScoredSkill[] = [];
        const selectedNames = new Set<string>();

        for (const match of clauseTopMatches) {
            const normName = match.skill.name.toLowerCase();
            if (!selectedNames.has(normName) && selectedSkills.length < topK) {
                selectedNames.add(normName);
                selectedSkills.push(match);
            }
        }

        for (const cand of candidates) {
            if (selectedSkills.length >= topK) break;
            const normName = cand.skill.name.toLowerCase();
            if (!selectedNames.has(normName)) {
                if (cand.score >= multiSkillThreshold && cand.score >= candidates[0].score * 0.50) {
                    selectedNames.add(normName);
                    selectedSkills.push(cand);
                }
            }
        }

        if (selectedSkills.length === 0) {
            selectedSkills.push(candidates[0]);
        }

        return {
            query: trimmedQuery,
            selectedSkills,
            confidence: candidates[0].confidence,
            isNoSkill: false,
            consideredCount: this.skills.length,
            executionTimeMs: duration,
            explanation: options.explain
                ? {
                    summary: `Selected ${selectedSkills.length} skill(s) via hybrid ranking.`,
                    candidates: candidates.slice(0, Math.max(topK, selectedSkills.length)),
                }
                : undefined,
        };
    }
}

function matchOrZero(val: number | undefined): number {
    return typeof val === 'number' ? val : 0;
}
