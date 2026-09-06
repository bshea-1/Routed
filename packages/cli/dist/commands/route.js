import { RoutedDatabase, HybridRouter } from '../../../core/dist/index.js';
import { runScan } from './scan.js';
export async function runRoute(options) {
    const db = new RoutedDatabase();
    let skills = db.getAllSkills();
    if (skills.length === 0 && options.autoScan !== false) {
        if (!options.json) {
            console.log('No skills indexed yet. Performing initial scan...');
        }
        const scanResult = runScan({ quiet: options.json });
        skills = scanResult.skills;
    }
    const router = new HybridRouter(skills, db);
    const result = await router.route(options.prompt, {
        explain: options.explain,
        topK: options.topK,
        threshold: options.threshold ?? 0.20,
    });
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return result;
    }
    if (result.isNoSkill || result.selectedSkills.length === 0) {
        console.log('\nNo specific skill required for this prompt.');
        console.log('Continuing with standard agent capabilities.\n');
        return result;
    }
    console.log('');
    for (const item of result.selectedSkills) {
        const scoreStr = item.score.toFixed(2);
        console.log(`${item.skill.name.padEnd(28)} ${scoreStr}`);
    }
    console.log('\nSelected:');
    for (const item of result.selectedSkills) {
        console.log(`${item.skill.name}`);
    }
    if (options.explain && result.explanation) {
        console.log('\n--- Explanation ---');
        console.log(`Summary: ${result.explanation.summary}`);
        console.log(`Execution time: ${result.executionTimeMs.toFixed(1)}ms`);
        for (const cand of result.explanation.candidates) {
            console.log(`\nSkill: ${cand.skill.name}`);
            console.log(`  Overall Score:        ${cand.score.toFixed(2)}`);
            console.log(`  Semantic Similarity:  ${cand.signals.semanticScore.toFixed(2)}`);
            console.log(`  Lexical (BM25):       ${cand.signals.bm25Score.toFixed(2)} (raw: ${cand.signals.rawBm25Score.toFixed(2)})`);
            console.log(`  Exact Match:          ${cand.signals.exactMatch > 0 ? cand.signals.exactMatch.toFixed(2) : 'no'}`);
            console.log(`  Alias Match:          ${cand.signals.aliasMatch > 0 ? cand.signals.aliasMatch.toFixed(2) : 'no'}`);
            if (cand.signals.matchedTokens.length > 0) {
                console.log(`  Matched Tokens:       ${cand.signals.matchedTokens.join(', ')}`);
            }
            if (cand.signals.historyBonus && cand.signals.historyBonus > 0) {
                console.log(`  Adaptive History:     +${cand.signals.historyBonus.toFixed(2)} (decayed count: ${cand.signals.decayedCount?.toFixed(1) ?? '1.0'})`);
            }
        }
    }
    console.log('');
    return result;
}
//# sourceMappingURL=route.js.map