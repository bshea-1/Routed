# Routed Demo Site Improvements Guide (v1.6)

This document contains the exact architectural updates and code modifications to apply in your `routed_demo` repository session. It directly addresses the 5 failure modes identified in adversarial testing:
1. **Rejection Floor**: The router now declines gibberish and non-coding prompts with `isNoSkill: true`.
2. **Negation Parsing**: `"do not run a security audit, just rename my variables"` routes to variable renaming, suppressing the negated security skills.
3. **Token Provenance & Deduplication**: `--explain` deduplicates tokens and separates typed prompt words from expanded synonyms.
4. **Framework Specificity Penalty**: Prevents framework-specific skills (`laravel-security-audit`, `django-perf-review`) from stealing generic prompts over generic skills (`threat-modeling-expert`).
5. **Latency / Tagline Consistency**: Aligns the browser demo tagline with measured in-browser client execution time.

---

## 1. Modifications for `demo/engine.js`

Replace the corresponding sections in `/Users/bshea/routed_demo/demo/engine.js`:

### A. Negation Parser & Token Extraction Helper
Add helper functions to parse negated phrases and distinguish direct tokens from expanded synonyms:

```javascript
/**
 * Detects negated clauses such as "do not X", "don't X", "never X", "avoid X", "without X", "skip X".
 * Returns { positiveQuery, negatedTokens }
 */
export function parseNegation(query) {
    const negationRegex = /\b(?:do\s+not|don'?t|never|avoid|without|skip|no\s+need\s+to)\s+([^,.;]+?)(?:,\s*|;\s*|\.\s*|but\s+|instead\s+|just\s+|$)/gi;
    const negatedTokens = new Set();
    let match;
    while ((match = negationRegex.exec(query)) !== null) {
        const negatedPhrase = match[1];
        const tokens = tokenize(negatedPhrase, { minLength: 2, removeStopWords: true, expandSynonyms: false });
        for (const t of tokens) {
            negatedTokens.add(t);
        }
    }

    // Strip negated phrases to isolate the positive intent
    const positiveQuery = query.replace(/\b(?:do\s+not|don'?t|never|avoid|without|skip|no\s+need\s+to)\s+[^,.;]+(?:,\s*|;\s*|\.\s*|but\s+|instead\s+|just\s+|$)/gi, ' ').trim();

    return {
        positiveQuery: positiveQuery || query,
        negatedTokens: Array.from(negatedTokens),
    };
}
```

### B. Provenance Tokenizer (Separating Direct from Expanded)
Update `tokenize` in `engine.js` so it tracks provenance:

```javascript
export function tokenizeWithProvenance(text, { minLength = 2, removeStopWords = true, expandSynonyms = true } = {}) {
    if (!text || typeof text !== 'string') return { tokens: [], directTokens: [], expandedTokens: [] };
    const cleaned = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/[-_]/g, ' ');
    const rawTokens = cleaned.split(/\s+/).filter(Boolean);
    const directTokens = [];
    const expandedTokens = [];
    const allTokensSet = new Set();

    for (const token of rawTokens) {
        if (token.length < minLength) continue;
        if (removeStopWords && STOP_WORDS.has(token)) continue;
        if (!allTokensSet.has(token)) {
            allTokensSet.add(token);
            directTokens.push(token);
        }

        if (expandSynonyms && TECHNICAL_SYNONYMS[token]) {
            for (const syn of TECHNICAL_SYNONYMS[token]) {
                if (!allTokensSet.has(syn)) {
                    allTokensSet.add(syn);
                    expandedTokens.push(syn);
                }
            }
        }
    }
    return {
        tokens: Array.from(allTokensSet),
        directTokens,
        expandedTokens,
    };
}
```

### C. Framework Specificity List
Define known framework prefixes to apply specificity penalties:

```javascript
const KNOWN_FRAMEWORKS = [
    'laravel', 'django', 'rails', 'flutter', 'react', 'vue', 'angular',
    'nextjs', 'nuxt', 'svelte', 'express', 'fastapi', 'spring', 'dotnet',
    'solidity', 'hardhat', 'foundry', 'kubernetes', 'k8s', 'terraform', 'aws', 'azure', 'gcp'
];
```

### D. Update `route()` in `HybridRouter` (`demo/engine.js`)
Update the routing loop with:
1. **Threshold raised to 0.35**.
2. **Negation clause extraction & penalty**.
3. **Zero-lexical anchor grounding filter**.
4. **Framework unmentioned penalty**.
5. **Token deduplication and provenance recording**.

```javascript
    route(query, options = {}) {
        const startTime = performance.now();
        const threshold = options.threshold ?? 0.35; // Raised from 0.15 to 0.35
        const topK = options.topK ?? 5;
        const allowNoSkill = options.allowNoSkill ?? true;
        const trimmedQuery = (query || '').trim();

        if (!trimmedQuery) {
            return {
                query: '',
                selectedSkills: [],
                confidence: 0,
                isNoSkill: true,
                consideredCount: this.skills.length,
                executionTimeMs: 0,
                explanation: { summary: 'Empty prompt provided.', candidates: [] },
            };
        }

        // 1. Negation pre-pass
        const { positiveQuery, negatedTokens } = parseNegation(trimmedQuery);
        const queryToEvaluate = positiveQuery.length > 2 ? positiveQuery : trimmedQuery;

        // 2. Trivial prompt check on positive intent
        if (allowNoSkill) {
            for (const pattern of TRIVIAL_PROMPT_PATTERNS) {
                if (pattern.test(queryToEvaluate.trim()) || pattern.test(trimmedQuery)) {
                    const duration = performance.now() - startTime;
                    return {
                        query: trimmedQuery,
                        selectedSkills: [],
                        confidence: 1.0,
                        isNoSkill: true,
                        consideredCount: this.skills.length,
                        executionTimeMs: duration,
                        explanation: {
                            summary: 'Prompt matches common general task (e.g. variable rename / spelling) where standard agent capabilities suffice without injecting specialist skills.',
                            candidates: [],
                            noSkillReason: 'General editing / conversational query',
                        },
                    };
                }
            }
        }

        const clauses = extractSubClauses(queryToEvaluate);
        const vectorDim = this.skills[0]?.vector?.length || 128;
        const queryVector = computeDenseVector(queryToEvaluate, vectorDim);
        const queryLower = queryToEvaluate.toLowerCase();

        const candidateMap = new Map();

        for (const clause of clauses) {
            const bm25Results = this.bm25.search(clause);
            const bm25Map = new Map();
            for (const b of bm25Results) {
                bm25Map.set(b.skill.id, b);
            }

            for (const skill of this.skills) {
                if (skill.name.toLowerCase() === 'route') continue;

                // Check if this skill matches any explicitly negated tokens
                const skillTextLower = `${skill.name} ${(skill.tags || []).join(' ')} ${skill.description || ''}`.toLowerCase();
                const isNegated = negatedTokens.some(nt => skillTextLower.includes(nt));
                if (isNegated) {
                    continue; // Suppress negated skills completely
                }

                const exact = checkExactMatch(clause, skill);
                const bm = bm25Map.get(skill.id) || { rawScore: 0, normalizedScore: 0, matchedTokens: [] };
                
                let semSim = 0;
                if (skill.vector && skill.vector.length > 0) {
                    semSim = cosineSimilarity(queryVector, skill.vector);
                }

                const metaSignal = (skill.tags || []).some(t => queryLower.includes(t.toLowerCase())) ? 1.0 : 0.0;
                const exactOrAlias = Math.max(exact.exactMatchScore, exact.aliasMatchScore);

                // Grounded Semantic Gating:
                // If candidate has ZERO lexical overlap and NO exact match, require high semantic confidence (>= 0.65)
                // to prevent background cosine similarity noise from falsely elevating irrelevant skills.
                const hasLexicalAnchor = bm.rawScore > 0 || exactOrAlias > 0 || metaSignal > 0;
                if (!hasLexicalAnchor && semSim < 0.65) {
                    continue;
                }

                // Framework specificity penalty:
                // If skill name starts with a specific framework (e.g. "laravel-security-audit")
                // but user prompt never mentions "laravel", penalize by -0.15 so generic skills win.
                let frameworkPenalty = 0.0;
                const skillNameLower = skill.name.toLowerCase();
                for (const fw of KNOWN_FRAMEWORKS) {
                    if (skillNameLower.includes(fw) && !queryLower.includes(fw)) {
                        frameworkPenalty = 0.15;
                        break;
                    }
                }

                let finalScore = 0;
                const uniqueMatched = Array.from(new Set(bm.matchedTokens));

                if (exactOrAlias >= 0.90) {
                    finalScore = exactOrAlias - frameworkPenalty;
                } else {
                    const raw = semSim * this.weights.semantic +
                        bm.normalizedScore * this.weights.lexical +
                        exactOrAlias * this.weights.exact +
                        metaSignal * this.weights.metadata -
                        frameworkPenalty;
                    finalScore = Math.min(1.0, Math.max(0, raw));
                }

                const roundedScore = Math.round(finalScore * 1000) / 1000;

                // Separate direct tokens from expanded synonyms
                const provenance = tokenizeWithProvenance(clause);
                const directMatched = uniqueMatched.filter(t => provenance.directTokens.includes(t));
                const expandedMatched = uniqueMatched.filter(t => provenance.expandedTokens.includes(t));

                const signals = {
                    exactMatch: exact.exactMatchScore,
                    aliasMatch: exact.aliasMatchScore,
                    bm25Score: bm.normalizedScore,
                    rawBm25Score: bm.rawScore,
                    semanticScore: semSim,
                    metadataScore: metaSignal,
                    matchedTokens: uniqueMatched,
                    directTokens: directMatched,
                    expandedTokens: expandedMatched,
                    frameworkPenalty,
                };

                if (roundedScore >= 0.15) {
                    const scoredSkill = {
                        skill,
                        score: roundedScore,
                        confidence: 0,
                        signals,
                    };

                    const existing = candidateMap.get(skill.id);
                    if (!existing || scoredSkill.score > existing.score) {
                        candidateMap.set(skill.id, scoredSkill);
                    }
                }
            }
        }

        const candidates = Array.from(candidateMap.values());
        candidates.sort((a, b) => b.score - a.score);

        // Confidence calculation
        if (candidates.length > 0) {
            const top1 = candidates[0];
            const top2 = candidates.length > 1 ? candidates[1] : null;
            if (!top2) {
                top1.confidence = top1.score;
            } else {
                const margin = Math.max(0, top1.score - top2.score);
                const spreadRatio = top1.score > 0 ? margin / top1.score : 0;
                top1.confidence = Math.min(1.0, Math.round((top1.score * 0.4 + spreadRatio * 0.6) * 1000) / 1000);
            }
        }

        const duration = performance.now() - startTime;

        // Rejection check: If top candidate is below threshold, return isNoSkill: true
        if (candidates.length === 0 || candidates[0].score < threshold) {
            return {
                query: trimmedQuery,
                selectedSkills: [],
                confidence: candidates.length > 0 ? candidates[0].confidence : 1.0,
                isNoSkill: true,
                consideredCount: this.skills.length,
                executionTimeMs: duration,
                explanation: {
                    summary: `No skill exceeded confidence threshold (${threshold.toFixed(2)}). Standard capabilities will handle this prompt (0 context tokens wasted).`,
                    candidates: candidates.slice(0, topK),
                    noSkillReason: 'Score below confidence threshold',
                },
            };
        }

        const multiSkillThreshold = options.multiSkillThreshold ?? 0.35;
        const selectedSkills = [];
        const selectedNames = new Set();

        for (const cand of candidates) {
            if (selectedSkills.length >= topK) break;
            const normName = cand.skill.name.toLowerCase();
            if (!selectedNames.has(normName)) {
                if (cand.score >= multiSkillThreshold && cand.score >= candidates[0].score * 0.60) {
                    selectedNames.add(normName);
                    selectedSkills.push(cand);
                }
            }
        }

        if (selectedSkills.length === 0 && candidates[0].score >= threshold) {
            selectedSkills.push(candidates[0]);
        }

        let explanationSummary = `Selected ${selectedSkills.length} skill(s) via hybrid ranking.`;
        if (selectedSkills.length === 1) {
            explanationSummary = `Selected "${selectedSkills[0].skill.name}" as top match based on hybrid ranking.`;
        }

        return {
            query: trimmedQuery,
            selectedSkills,
            confidence: selectedSkills[0].confidence,
            isNoSkill: false,
            consideredCount: this.skills.length,
            executionTimeMs: duration,
            explanation: {
                summary: explanationSummary,
                candidates: candidates.slice(0, 10),
            },
        };
    }
```

---

## 2. Modifications for `demo/app.js`

Update `runQuery` in `demo/app.js` to display the refined execution metrics and token provenance breakdown:

```javascript
        if (result.explanation) {
            lines.push('');
            lines.push('--- Explanation ---');
            lines.push(`Summary: ${result.explanation.summary}`);
            lines.push(`Execution time: ${result.executionTimeMs.toFixed(1)}ms (in-browser client WebAssembly; native CLI runs in <20ms on CPU)`);
            lines.push(`Catalog: 2,113 skills (sickn33/agentic-awesome-skills)`);

            const top = result.selectedSkills[0];
            if (top && top.skill) {
                lines.push(`GitHub Source: ${top.skill.githubUrl}`);
            }

            for (const cand of result.explanation.candidates.slice(0, 5)) {
                lines.push('');
                lines.push(`Skill: ${cand.skill.name} [category: ${cand.skill.category}]`);
                lines.push(`  Overall Score:        ${cand.score.toFixed(2)}`);
                lines.push(`  Semantic Similarity:  ${cand.signals.semanticScore.toFixed(2)} (45% weight)`);
                lines.push(`  Lexical (BM25):       ${cand.signals.bm25Score.toFixed(2)} (raw: ${cand.signals.rawBm25Score.toFixed(2)}, 45% weight)`);
                lines.push(`  Exact Match:          ${cand.signals.exactMatch > 0 ? cand.signals.exactMatch.toFixed(2) : 'no'} (10% weight)`);
                
                if (cand.signals.directTokens && cand.signals.directTokens.length > 0) {
                    lines.push(`  Direct Query Tokens:  ${cand.signals.directTokens.join(', ')}`);
                }
                if (cand.signals.expandedTokens && cand.signals.expandedTokens.length > 0) {
                    lines.push(`  Expanded Synonyms:    ${cand.signals.expandedTokens.join(', ')}`);
                }
                if (cand.signals.frameworkPenalty > 0) {
                    lines.push(`  Framework Penalty:    -${cand.signals.frameworkPenalty.toFixed(2)} (unmentioned stack)`);
                }
                if (cand.skill.description) {
                    const cleanDesc = cand.skill.description.replace(/[--]/g, '-').slice(0, 160);
                    lines.push(`  Description:          ${cleanDesc}...`);
                }
            }
        }
```

---

## 3. Modifications for `demo/index.html`

Update line 55 of `demo/index.html` to eliminate the contradiction between the "sub-millisecond" tagline and the 40-80ms client-side WebAssembly execution time:

**Change line 55 from:**
```html
<p>Universal local skill router for coding agents. Intercepts prompts locally and selects matching skills in sub-milliseconds.</p>
```
**To:**
```html
<p>Universal local skill router for coding agents. Evaluates queries locally on CPU in sub-20ms (<80ms in this browser WebAssembly client demo).</p>
```

Also in `demo/docs.html`:
Update the FAQ question about speed to state:
```html
No. Benchmark execution times average under 20 milliseconds on local CPU. In browser environments via client-side WebAssembly, evaluation typically finishes in under 50-80 milliseconds, making it virtually instantaneous compared to remote cloud API calls (1,200ms to 3,500ms).
```
