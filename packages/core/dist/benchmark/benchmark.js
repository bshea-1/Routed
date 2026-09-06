export const BENCHMARK_CASES = [
    {
        id: 'exact-1',
        category: 'exact-match',
        prompt: 'a11y-debugging',
        expectedSkills: ['a11y-debugging'],
        description: 'Exact skill name invocation',
    },
    {
        id: 'exact-2',
        category: 'exact-match',
        prompt: 'memory-leak-debugging in node',
        expectedSkills: ['memory-leak-debugging'],
        description: 'Direct skill name with runtime qualifier',
    },
    {
        id: 'synonym-1',
        category: 'synonym',
        prompt: 'inspect and resolve high RAM consumption and garbage collection spikes in nodejs',
        expectedSkills: ['memory-leak-debugging'],
        description: 'Synonyms for memory leak (RAM consumption, GC spikes)',
    },
    {
        id: 'synonym-2',
        category: 'synonym',
        prompt: 'audit tap targets, contrast ratios, and screen reader labels on our web page',
        expectedSkills: ['a11y-debugging'],
        description: 'Detailed accessibility criteria without saying a11y',
    },
    {
        id: 'jargon-1',
        category: 'technical-jargon',
        prompt: 'analyze LCP bottlenecks and Core Web Vitals breakdown for our landing page',
        expectedSkills: ['debug-optimize-lcp'],
        description: 'LCP and Core Web Vitals technical jargon',
    },
    {
        id: 'jargon-2',
        category: 'technical-jargon',
        prompt: 'evaluate Firestore security rules and check access control boundaries',
        expectedSkills: ['firebase-security-rules-auditor'],
        description: 'Firestore security rules audit',
    },
    {
        id: 'abbrev-1',
        category: 'abbreviation',
        prompt: 'check a11y compliance',
        expectedSkills: ['a11y-debugging'],
        description: 'Common abbreviation a11y',
    },
    {
        id: 'abbrev-2',
        category: 'abbreviation',
        prompt: 'fix OOM crashes in our backend service',
        expectedSkills: ['memory-leak-debugging'],
        description: 'OOM (Out of Memory) abbreviation',
    },
    {
        id: 'multi-de-1',
        category: 'multilingual',
        prompt: 'Speicherleck in node debuggen',
        expectedSkills: ['memory-leak-debugging'],
        description: 'German compound noun Speicherleck for memory-leak-debugging',
    },
    {
        id: 'multi-de-2',
        category: 'multilingual',
        prompt: 'Sicherheitsrichtlinien und Firestore Zugriffsregeln prüfen',
        expectedSkills: ['firebase-security-rules-auditor'],
        description: 'German security rules audit for Firestore',
    },
    {
        id: 'multi-es-1',
        category: 'multilingual',
        prompt: 'encontrar y depurar fugas de memoria en nodejs',
        expectedSkills: ['memory-leak-debugging'],
        description: 'Spanish memory leak debugging prompt',
    },
    {
        id: 'multi-fr-1',
        category: 'multilingual',
        prompt: 'optimiser le Largest Contentful Paint et Core Web Vitals',
        expectedSkills: ['debug-optimize-lcp'],
        description: 'French Core Web Vitals optimization prompt',
    },
    {
        id: 'intent-1',
        category: 'indirect-intent',
        prompt: 'why does our frontend take 4 seconds before the hero image is visible?',
        expectedSkills: ['debug-optimize-lcp'],
        description: 'Indirect symptom of Largest Contentful Paint delay',
    },
    {
        id: 'noskill-1',
        category: 'no-skill',
        prompt: 'rename variable totalAmount to grandTotal',
        expectedSkills: [],
        description: 'Simple code rename not requiring a specialized skill',
    },
    {
        id: 'noskill-2',
        category: 'no-skill',
        prompt: 'hello, how are you today?',
        expectedSkills: [],
        description: 'Conversational prompt without coding task',
    },
    {
        id: 'noskill-3',
        category: 'no-skill',
        prompt: 'fix spelling typo in README.md line 12',
        expectedSkills: [],
        description: 'Trivial typo edit',
    },
];
export async function runBenchmark(router, customCases = BENCHMARK_CASES) {
    const results = [];
    const latencies = [];
    let top1Matches = 0;
    let top3Matches = 0;
    let noSkillMatches = 0;
    let noSkillCases = 0;
    for (const tc of customCases) {
        const t0 = performance.now();
        const routeRes = await router.route(tc.prompt, { allowNoSkill: true, topK: 3 });
        const latency = performance.now() - t0;
        latencies.push(latency);
        const actual = routeRes.selectedSkills.map((s) => s.skill.name);
        if (tc.expectedSkills.length === 0) {
            noSkillCases++;
            const isCorrect = routeRes.isNoSkill || actual.length === 0;
            if (isCorrect) {
                noSkillMatches++;
                top1Matches++;
                top3Matches++;
            }
            results.push({
                id: tc.id,
                prompt: tc.prompt,
                category: tc.category,
                expected: [],
                actual,
                isTop1Match: isCorrect,
                isTop3Match: isCorrect,
                latencyMs: Math.round(latency * 10) / 10,
            });
        }
        else {
            const top1Match = actual.length > 0 && tc.expectedSkills.includes(actual[0]);
            const top3Match = actual.some((a) => tc.expectedSkills.includes(a));
            if (top1Match)
                top1Matches++;
            if (top3Match)
                top3Matches++;
            results.push({
                id: tc.id,
                prompt: tc.prompt,
                category: tc.category,
                expected: tc.expectedSkills,
                actual,
                isTop1Match: top1Match,
                isTop3Match: top3Match,
                latencyMs: Math.round(latency * 10) / 10,
            });
        }
    }
    latencies.sort((a, b) => a - b);
    const total = customCases.length;
    const meanLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const medianLatency = latencies.length > 0 ? latencies[Math.floor(latencies.length / 2)] : 0;
    return {
        totalCases: total,
        top1Accuracy: Math.round((top1Matches / total) * 1000) / 10,
        top3Recall: Math.round((top3Matches / total) * 1000) / 10,
        noSkillAccuracy: noSkillCases > 0 ? Math.round((noSkillMatches / noSkillCases) * 1000) / 10 : 100,
        meanLatencyMs: Math.round(meanLatency * 10) / 10,
        medianLatencyMs: Math.round(medianLatency * 10) / 10,
        passedCount: top1Matches,
        failedCount: total - top1Matches,
        results,
    };
}
//# sourceMappingURL=benchmark.js.map