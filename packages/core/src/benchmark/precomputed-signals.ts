import { BenchmarkCase, SkillMetadata, TunableParameters } from '../types.js';
import { BM25Engine } from '../lexical/bm25.js';
import { checkExactMatch } from '../lexical/exact.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
import { RoutedDatabase } from '../storage/database.js';

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
    const clauses = parts.map((p) => p.trim()).filter((p) => p.length > 2);
    if (clauses.length <= 1) {
        return [trimmed];
    }
    return [trimmed, ...clauses];
}

export interface CandidateSignal {
    skillName: string;
    exactScore: number;
    bm25Score: number;
    semanticScore: number;
    metaScore: number;
}

export interface PrecomputedCaseSignal {
    caseId: string;
    prompt: string;
    isTrivialNoSkill: boolean;
    hasExactMatch: boolean;
    exactTopSkills: string[];
    candidates: CandidateSignal[];
}

export class PrecomputedSignalsEngine {
    private caseSignals: Map<string, PrecomputedCaseSignal> = new Map();

    public async precomputeAll(
        cases: BenchmarkCase[],
        skills: SkillMetadata[],
        db: RoutedDatabase,
        semanticEngine: SemanticEngine,
        bm25Engine: BM25Engine,
        onProgress?: (completed: number, total: number) => void
    ): Promise<void> {
        let completed = 0;
        const total = cases.length;

        for (const tc of cases) {
            const signal = await this.precomputeQuery(tc.prompt, skills, db, semanticEngine, bm25Engine);
            this.caseSignals.set(tc.id, signal);
            completed++;
            if (onProgress) {
                onProgress(completed, total);
            }
        }
    }

    public async precomputeQuery(
        prompt: string,
        skills: SkillMetadata[],
        db: RoutedDatabase,
        semanticEngine: SemanticEngine,
        bm25Engine: BM25Engine
    ): Promise<PrecomputedCaseSignal> {
        const trimmed = prompt.trim();

        // 1. Trivial check
        let isTrivial = false;
        for (const p of TRIVIAL_PROMPT_PATTERNS) {
            if (p.test(trimmed)) {
                isTrivial = true;
                break;
            }
        }

        const clauses = extractSubClauses(trimmed);
        const exactMatches: Array<{ name: string; score: number }> = [];
        const seenExact = new Set<string>();

        // 2. Exact match check
        for (const clause of clauses) {
            for (const skill of skills) {
                if (skill.name.toLowerCase() === 'route') continue;
                const match = checkExactMatch(clause, skill);
                const score = Math.max(match.exactMatchScore, match.aliasMatchScore);
                const normName = skill.name.toLowerCase();
                if (score >= 0.90 && !seenExact.has(normName)) {
                    seenExact.add(normName);
                    exactMatches.push({ name: skill.name, score });
                }
            }
        }

        exactMatches.sort((a, b) => b.score - a.score);
        const hasExactMatch = exactMatches.length > 0 && exactMatches[0].score >= 0.95;
        const exactTopSkills = exactMatches.map((m) => m.name);

        // 3. Dense retrieval signals across clauses
        const candidateMap = new Map<string, CandidateSignal>();

        for (const clause of clauses) {
            const bm25Results = bm25Engine.search(clause);
            const bm25Map = new Map<string, number>();
            for (const b of bm25Results) {
                bm25Map.set(b.skill.name.toLowerCase(), b.normalizedScore);
            }

            const semResults = await semanticEngine.search(clause, skills, db);
            const semMap = new Map<string, number>();
            for (const s of semResults) {
                semMap.set(s.skill.name.toLowerCase(), s.similarity);
            }

            const queryLower = clause.toLowerCase();

            for (const skill of skills) {
                if (skill.name.toLowerCase() === 'route') continue;
                const normName = skill.name.toLowerCase();
                const bmScore = bm25Map.get(normName) || 0;
                const semScore = semMap.get(normName) || 0;
                const exact = checkExactMatch(clause, skill);
                const exScore = Math.max(exact.exactMatchScore, exact.aliasMatchScore);
                const metaScore =
                    skill.tags.some((t) => queryLower.includes(t.toLowerCase())) ||
                    skill.keywords.some((k) => queryLower.includes(k.toLowerCase()))
                        ? 1.0
                        : 0.0;

                // Keep candidates that show non-trivial signal
                if (bmScore > 0.05 || semScore > 0.40 || exScore > 0.20 || metaScore > 0) {
                    const existing = candidateMap.get(normName);
                    if (!existing) {
                        candidateMap.set(normName, {
                            skillName: skill.name,
                            exactScore: exScore,
                            bm25Score: bmScore,
                            semanticScore: semScore,
                            metaScore,
                        });
                    } else {
                        // Keep highest signals across clauses
                        existing.exactScore = Math.max(existing.exactScore, exScore);
                        existing.bm25Score = Math.max(existing.bm25Score, bmScore);
                        existing.semanticScore = Math.max(existing.semanticScore, semScore);
                        existing.metaScore = Math.max(existing.metaScore, metaScore);
                    }
                }
            }
        }

        return {
            caseId: '',
            prompt,
            isTrivialNoSkill: isTrivial,
            hasExactMatch,
            exactTopSkills,
            candidates: Array.from(candidateMap.values()),
        };
    }

    public evaluateWithParams(
        cases: BenchmarkCase[],
        params: TunableParameters,
        topK = 5
    ): Array<{ actual: string[]; isNoSkill: boolean }> {
        const sw = params.semanticWeight;
        const lw = params.lexicalWeight;
        const ew = params.exactWeight;
        const mw = params.metadataWeight;
        const threshold = params.threshold ?? 0.20;

        const results: Array<{ actual: string[]; isNoSkill: boolean }> = [];

        for (const tc of cases) {
            const signal = this.caseSignals.get(tc.id);
            if (!signal) {
                results.push({ actual: [], isNoSkill: true });
                continue;
            }

            if (signal.isTrivialNoSkill) {
                results.push({ actual: [], isNoSkill: true });
                continue;
            }

            if (signal.hasExactMatch && signal.exactTopSkills.length > 0) {
                results.push({
                    actual: signal.exactTopSkills.slice(0, topK),
                    isNoSkill: false,
                });
                continue;
            }

            const scoredCandidates: Array<{ name: string; score: number }> = [];

            for (const cand of signal.candidates) {
                if (cand.exactScore >= 0.90) {
                    scoredCandidates.push({ name: cand.skillName, score: cand.exactScore });
                    continue;
                }
                const score =
                    cand.semanticScore * sw +
                    cand.bm25Score * lw +
                    cand.exactScore * ew +
                    cand.metaScore * mw;

                if (score >= threshold) {
                    scoredCandidates.push({ name: cand.skillName, score });
                }
            }

            if (scoredCandidates.length === 0) {
                results.push({ actual: [], isNoSkill: true });
            } else {
                scoredCandidates.sort((a, b) => b.score - a.score);
                results.push({
                    actual: scoredCandidates.slice(0, topK).map((c) => c.name),
                    isNoSkill: false,
                });
            }
        }

        return results;
    }

    public getSignal(caseId: string): PrecomputedCaseSignal | undefined {
        return this.caseSignals.get(caseId);
    }
}
