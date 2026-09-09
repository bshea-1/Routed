import { BM25Engine } from '../lexical/bm25.js';
import { checkExactMatch } from '../lexical/exact.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
import { HybridScorer } from '../scorer/hybrid-scorer.js';
import { RoutedDatabase } from '../storage/database.js';
import { LearningStore } from '../learning/learning-store.js';
import { parseNegation } from '../lexical/tokenizer.js';
const TRIVIAL_PROMPT_PATTERNS = [
    /^(?:(?:just|please|only)\s+)*(rename|change)\s+(?:all\s+|my\s+|the\s+|this\s+|a\s+)?(variable|function|param|parameter|method|class|field|type)s?\b/i,
    /^(?:(?:just|please|only)\s+)*(fix|correct)\s+(?:all\s+|my\s+|the\s+|this\s+|a\s+)?(?:typo|spelling|spelling\s+mistakes?)s?\b/i,
    /^(hello|hi|hey|thanks|thank you|ok|okay|bye|cool|awesome|sounds good|good morning|good afternoon|good evening|see you|bye)\b/i,
    /^(what is|explain)\s+(this|the)\s+(single\s+)?(line|word|function|statement)\b/i,
    /^(?:(?:just|please|only)\s+)*(format|indent|pretty\s*print)\s+(?:this|the)\s+(?:javascript\s+|typescript\s+|python\s+)?(json|string|file|code|array|object)\b/i,
    /^(?:(?:just|please|only)\s+)*(add|insert)\s+(a\s+)?(single\s+|blank\s+)?(line\s+)?(comment|line)\b/i,
    /^(?:(?:just|please|only)\s+)*clean\s*up\s+(?:the\s+|my\s+)?comments?\b/i,
    /^(?:(?:just|please|only)\s+)*(delete|remove)\s+(the\s+)?(?:(?:unused|trailing|empty|blank)\s+)*(import|line|variable|comment|statement)s?\b/i,
    /^(?:(?:just|please|only)\s+)*(delete|remove)\s+(the\s+)?(?:console\.log|print|debugger)\b/i,
    /^(?:(?:just|please|only)\s+)*(change|update|set)\s+(the\s+)?(background\s+|button\s+)?color\b/i,
    /^(?:(?:just|please|only)\s+)*(change|update|set|toggle)\s+(?:the\s+)?(?:variable\s+)?flag\b/i,
    /^(?:what is|calculate|solve for?)\s+(?:the\s+)?(?:\d+|x\b|square root|\d+\s*percent)/i,
    /^if a (?:car|train|plane|vehicle) travels\b/i,
    /^(?:can you recommend an authentic|can you recommend a good|what should i cook|what is the capital|what is the chemical formula|who won the|what are the health benefits|what are good indoor|tell me a (?:funny\s+)?(?:dad\s+)?joke|write a (?:short\s+)?(?:romantic\s+)?poem|how far is the moon|brainstorm (?:ten\s+)?catchy names)/i,
];
function isGibberish(text) {
    const words = text.trim().toLowerCase().split(/\s+/);
    if (words.length === 0)
        return true;
    const longWords = words.filter(w => /^[a-z]{3,}$/.test(w));
    if (longWords.length > 0 && longWords.every(w => !/[aeiouy]/.test(w))) {
        return true;
    }
    return false;
}
const KNOWN_FRAMEWORKS = [
    'laravel', 'django', 'rails', 'flask', 'fastapi', 'spring', 'express', 'nestjs',
    'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'astro',
    'flutter', 'react-native', 'swiftui', 'jetpack-compose',
    'kubernetes', 'k8s', 'docker', 'terraform', 'ansible',
    'aws', 'azure', 'gcp',
];
function isSkillNegated(skill, negatedTokens) {
    if (negatedTokens.length === 0)
        return false;
    const skillTokens = new Set([
        ...skill.name.toLowerCase().split(/[-_]/),
        ...skill.tags.map(t => t.toLowerCase()),
        ...skill.keywords.map(k => k.toLowerCase()),
    ]);
    return negatedTokens.some(nt => skillTokens.has(nt));
}
function getFrameworkPenalty(skill, queryLower) {
    const skillNameLower = skill.name.toLowerCase();
    const tagsLower = skill.tags.map(t => t.toLowerCase());
    for (const fw of KNOWN_FRAMEWORKS) {
        const hasFw = skillNameLower.includes(fw) || tagsLower.includes(fw);
        if (hasFw && !queryLower.includes(fw)) {
            return 0.15;
        }
    }
    return 0.0;
}
function extractSubClauses(query) {
    const trimmed = query.trim();
    const parts = trimmed.split(/\s+(?:and|also|plus|with|as well as|then|along with|\&|\+)\s+|[;,]+/i);
    const clauses = parts.map(p => p.trim()).filter(p => p.length > 2);
    if (clauses.length <= 1) {
        return [trimmed];
    }
    return [trimmed, ...clauses];
}
export class HybridRouter {
    bm25;
    semantic;
    scorer;
    db;
    learningStore;
    skills = [];
    constructor(skills = [], db, semantic, learningStore, scorer) {
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
    getScorer() {
        return this.scorer;
    }
    getDatabase() {
        return this.db;
    }
    updateSkills(skills) {
        this.skills = skills;
        this.bm25.index(skills);
    }
    async route(query, options = {}) {
        const startTime = performance.now();
        const threshold = options.threshold ?? 0.35;
        const multiSkillThreshold = options.multiSkillThreshold ?? 0.40;
        const allowNoSkill = options.allowNoSkill ?? true;
        const skipSemanticIfExact = options.skipSemanticIfExact ?? true;
        const trimmedQuery = query.trim();
        const { positiveQuery, negatedTokens } = parseNegation(trimmedQuery);
        const activeQuery = positiveQuery.length > 0 ? positiveQuery : trimmedQuery;
        if (allowNoSkill) {
            if (isGibberish(trimmedQuery)) {
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
                            summary: 'Prompt appears to be random character sequence without recognizable words.',
                            candidates: [],
                            noSkillReason: 'Unrecognized / gibberish query',
                        }
                        : undefined,
                };
            }
            const queryToCheck = activeQuery.toLowerCase();
            for (const pattern of TRIVIAL_PROMPT_PATTERNS) {
                if (pattern.test(queryToCheck)) {
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
        const clauses = extractSubClauses(activeQuery);
        const topK = options.topK ?? (clauses.length > 1 ? Math.min(10, Math.max(5, clauses.length * 2)) : 5);
        const exactSkillsFound = [];
        const seenExactNames = new Set();
        for (const clause of clauses) {
            for (const skill of this.skills) {
                if (skill.name.toLowerCase() === 'route')
                    continue;
                if (isSkillNegated(skill, negatedTokens))
                    continue;
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
                            directTokens: [skill.name],
                            expandedTokens: [],
                            frameworkPenalty: 0,
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
        const candidateMap = new Map();
        const clauseTopMatches = [];
        const getCandidateFloor = (cand) => {
            if (options.threshold !== undefined)
                return options.threshold;
            const matchedCount = ((cand.signals?.directTokens?.length ?? 0) + (cand.signals?.expandedTokens?.length ?? 0));
            const hasExactOrMeta = (cand.signals?.exactMatch ?? 0) > 0 || (cand.signals?.metadataScore ?? 0) > 0;
            const hasAnchor = hasExactOrMeta || ((cand.signals?.rawBm25Score ?? 0) > 0 && (matchedCount >= 2 || (cand.signals?.semanticScore ?? 0) >= 0.30));
            return hasAnchor ? 0.28 : 0.40;
        };
        for (const clause of clauses) {
            const bm25Results = this.bm25.search(clause);
            const bm25Map = new Map();
            for (const b of bm25Results) {
                bm25Map.set(b.skill.id, {
                    rawScore: b.rawScore,
                    normalizedScore: b.normalizedScore,
                    matchedTokens: b.matchedTokens,
                    directMatchedTokens: b.directMatchedTokens || [],
                    expandedMatchedTokens: b.expandedMatchedTokens || [],
                });
            }
            const semanticResults = await this.semantic.search(clause, this.skills, this.db);
            const semanticMap = new Map();
            for (const s of semanticResults) {
                semanticMap.set(s.skill.id, s.similarity);
            }
            const clauseCandidates = [];
            for (const skill of this.skills) {
                if (skill.name.toLowerCase() === 'route')
                    continue;
                if (isSkillNegated(skill, negatedTokens))
                    continue;
                const exact = checkExactMatch(clause, skill);
                const bm = bm25Map.get(skill.id) || {
                    rawScore: 0,
                    normalizedScore: 0,
                    matchedTokens: [],
                    directMatchedTokens: [],
                    expandedMatchedTokens: [],
                };
                const sem = semanticMap.get(skill.id) || 0;
                const queryLower = clause.toLowerCase();
                const metaSignal = skill.tags.some((t) => queryLower.includes(t.toLowerCase())) ||
                    skill.keywords.some((k) => queryLower.includes(k.toLowerCase())) ? 1.0 : 0.0;
                // Grounded semantic gating: reject pure embedding noise without lexical anchor unless semantic similarity is strong (>= 0.65)
                const matchedCount = (bm.directMatchedTokens?.length ?? 0) + (bm.expandedMatchedTokens?.length ?? 0);
                const hasExactOrMeta = exact.exactMatchScore > 0 || metaSignal > 0;
                const hasLexicalAnchor = hasExactOrMeta || (bm.rawScore > 0 && (matchedCount >= 2 || sem >= 0.30));
                if (!hasLexicalAnchor && sem < 0.65) {
                    continue;
                }
                const frameworkPenalty = getFrameworkPenalty(skill, queryLower);
                let customOptions = options;
                let prefInfo = null;
                if (this.learningStore) {
                    prefInfo = this.learningStore.getPreferenceInfo(clause, skill.id);
                    if (prefInfo && prefInfo.bonus > 0) {
                        customOptions = {
                            ...options,
                            metadataWeight: Math.min(0.25, (options.metadataWeight ?? 0.05) + prefInfo.bonus),
                        };
                    }
                }
                const components = {
                    semanticSimilarity: sem,
                    lexicalSimilarity: bm.normalizedScore,
                    exactOrAlias: Math.max(exact.exactMatchScore, matchOrZero(exact.aliasMatchScore)),
                    metadataSignal: prefInfo && prefInfo.bonus > 0 ? 1.0 : metaSignal,
                    rawBm25Score: bm.rawScore,
                    matchedTokens: bm.matchedTokens,
                    directTokens: bm.directMatchedTokens,
                    expandedTokens: bm.expandedMatchedTokens,
                    frameworkPenalty,
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
            if (clauseCandidates.length > 0) {
                const topClause = clauseCandidates[0];
                const clauseFloor = getCandidateFloor(topClause);
                if (topClause.score >= clauseFloor) {
                    clauseTopMatches.push(topClause);
                }
            }
        }
        const candidates = Array.from(candidateMap.values());
        candidates.sort((a, b) => b.score - a.score);
        this.scorer.calculateConfidence(candidates);
        const duration = performance.now() - startTime;
        const topCandidate = candidates[0];
        const topFloor = topCandidate ? getCandidateFloor(topCandidate) : 0.35;
        if (candidates.length === 0 || topCandidate.score < topFloor) {
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
        const selectedSkills = [];
        const selectedNames = new Set();
        for (const match of clauseTopMatches) {
            const normName = match.skill.name.toLowerCase();
            if (!selectedNames.has(normName) && selectedSkills.length < topK) {
                selectedNames.add(normName);
                selectedSkills.push(match);
            }
        }
        for (const cand of candidates) {
            if (selectedSkills.length >= topK)
                break;
            const normName = cand.skill.name.toLowerCase();
            if (!selectedNames.has(normName)) {
                const candFloor = getCandidateFloor(cand);
                const candMultiThreshold = options.multiSkillThreshold ?? (candFloor === 0.28 ? 0.35 : 0.42);
                if (cand.score >= candMultiThreshold && cand.score >= candidates[0].score * 0.50) {
                    selectedNames.add(normName);
                    selectedSkills.push(cand);
                }
            }
        }
        if (selectedSkills.length === 0 && topCandidate.score >= topFloor) {
            selectedSkills.push(topCandidate);
        }
        if (selectedSkills.length === 0) {
            return {
                query: trimmedQuery,
                selectedSkills: [],
                confidence: candidates.length > 0 ? candidates[0].confidence : 1.0,
                isNoSkill: true,
                consideredCount: this.skills.length,
                executionTimeMs: duration,
                explanation: options.explain
                    ? {
                        summary: 'No skill met selection threshold after filtering.',
                        candidates: candidates.slice(0, topK),
                        noSkillReason: 'Below confidence threshold',
                    }
                    : undefined,
            };
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
function matchOrZero(val) {
    return typeof val === 'number' ? val : 0;
}
//# sourceMappingURL=hybrid-router.js.map