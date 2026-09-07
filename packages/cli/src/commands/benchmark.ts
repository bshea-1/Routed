import {
    RoutedDatabase,
    HybridRouter,
    runBenchmark,
    BenchmarkMetrics,
    loadBenchmarkDataset,
    HybridScorerWeights,
} from '../../../core/dist/index.js';
import { runTuneCommand } from './tune.js';

export interface BenchmarkCommandOptions {
    json?: boolean;
    dataset?: string;
    weights?: string;
    gridSearch?: boolean;
    kFold?: number;
    apply?: boolean;
}

export async function runBenchmarkCommand(options: BenchmarkCommandOptions = {}): Promise<BenchmarkMetrics | void> {
    if (options.gridSearch || (options.kFold && options.kFold > 1)) {
        await runTuneCommand({
            folds: options.kFold ?? 5,
            dataset: options.dataset,
            apply: options.apply,
            json: options.json,
        });
        return;
    }

    const db = new RoutedDatabase();
    const skills = db.getAllSkills();
    if (skills.length === 0) {
        console.error('Error: No skills in database. Run `routed scan` first.');
        process.exit(1);
    }

    let customWeights: HybridScorerWeights | undefined;
    if (options.weights) {
        const parts = options.weights.split(',').map((p) => parseFloat(p.trim()));
        if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
            customWeights = {
                semanticWeight: parts[0],
                lexicalWeight: parts[1],
                exactWeight: parts[2],
                metadataWeight: parts[3],
            };
        } else {
            console.error('Error: Invalid --weights format. Expected: "<sem>,<lex>,<exact>,<meta>" (e.g. "0.45,0.40,0.10,0.05")');
            process.exit(1);
        }
    }

    const cases = loadBenchmarkDataset(options.dataset);
    const router = new HybridRouter(skills, db);

    if (!options.json) {
        console.log(`\nRunning Routed Benchmarks (${skills.length} skills indexed, ${cases.length} evaluation cases)...`);
        if (customWeights) {
            console.log(`Evaluating custom weights: S:${customWeights.semanticWeight} B:${customWeights.lexicalWeight} E:${customWeights.exactWeight} M:${customWeights.metadataWeight}`);
        }
        console.log('─────────────────────────────────────────────────────────\n');
    }

    const metrics = await runBenchmark(router, cases, { weights: customWeights });

    if (options.json) {
        console.log(JSON.stringify(metrics, null, 2));
        return metrics;
    }

    for (const res of metrics.results) {
        const mark = res.isTop1Match ? '[OK] PASS' : '[FAIL] FAIL';
        console.log(`${mark} [${res.category.padEnd(16)}] "${res.prompt.slice(0, 52)}"`);
        if (!res.isTop1Match) {
            console.log(`       Expected: ${res.expected.length ? res.expected.join(', ') : '(no-skill)'}`);
            console.log(`       Actual:   ${res.actual.length ? res.actual.join(', ') : '(no-skill)'}`);
        }
        console.log(`       Latency:  ${res.latencyMs}ms\n`);
    }

    console.log('─────────────────────────────────────────────────────────');
    console.log('Routing Benchmark Results:');
    console.log(`  • Top-1 Accuracy:     ${metrics.top1Accuracy}% (${metrics.passedCount}/${metrics.totalCases})`);
    console.log(`  • Top-3 Recall:       ${metrics.top3Recall}%`);
    if (metrics.top5Recall !== undefined) {
        console.log(`  • Top-5 Recall:       ${metrics.top5Recall}%`);
    }
    if (metrics.mrr !== undefined) {
        console.log(`  • Mean Reciprocal Rank (MRR): ${metrics.mrr}%`);
    }
    console.log(`  • No-Skill Accuracy:  ${metrics.noSkillAccuracy}%`);
    console.log(`  • Median Latency:     ${metrics.medianLatencyMs}ms`);
    console.log(`  • Mean Latency:       ${metrics.meanLatencyMs}ms`);

    if (metrics.categoryBreakdown && Object.keys(metrics.categoryBreakdown).length > 0) {
        console.log('\nCategory Performance Breakdown:');
        for (const [cat, data] of Object.entries(metrics.categoryBreakdown) as Array<[string, { total: number; passed: number; accuracy: number }]>) {
            console.log(`  • ${cat.padEnd(18)}: ${data.accuracy}% (${data.passed}/${data.total})`);
        }
    }
    console.log('─────────────────────────────────────────────────────────\n');
    return metrics;
}
