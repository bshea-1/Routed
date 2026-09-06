import { RoutedDatabase, HybridRouter, runBenchmark, BenchmarkMetrics } from '@routed/core';
export interface BenchmarkCommandOptions {
    json?: boolean;
}
export async function runBenchmarkCommand(options: BenchmarkCommandOptions = {}): Promise<BenchmarkMetrics> {
    const db = new RoutedDatabase();
    const skills = db.getAllSkills();
    if (skills.length === 0) {
        console.error('Error: No skills in database. Run `routed scan` first.');
        process.exit(1);
    }
    const router = new HybridRouter(skills, db);
    if (!options.json) {
        console.log(`\nRunning Routed Benchmarks (${skills.length} skills indexed)...`);
        console.log('─────────────────────────────────────────────────────────\n');
    }
    const metrics = await runBenchmark(router);
    if (options.json) {
        console.log(JSON.stringify(metrics, null, 2));
        return metrics;
    }
    for (const res of metrics.results) {
        const mark = res.isTop1Match ? '[OK] PASS' : '[FAIL] FAIL';
        console.log(`${mark} [${res.category.padEnd(16)}] "${res.prompt.slice(0, 48)}"`);
        if (!res.isTop1Match) {
            console.log(`       Expected: ${res.expected.length ? res.expected.join(', ') : '(no-skill)'}`);
            console.log(`       Actual:   ${res.actual.length ? res.actual.join(', ') : '(no-skill)'}`);
        }
        console.log(`       Latency:  ${res.latencyMs}ms\n`);
    }
    console.log('─────────────────────────────────────────────────────────');
    console.log('Routing Benchmark Results (Spec Section 42):');
    console.log(`  • Top-1 Accuracy:     ${metrics.top1Accuracy}% (${metrics.passedCount}/${metrics.totalCases})`);
    console.log(`  • Top-3 Recall:       ${metrics.top3Recall}%`);
    console.log(`  • No-Skill Accuracy:  ${metrics.noSkillAccuracy}%`);
    console.log(`  • Median Latency:     ${metrics.medianLatencyMs}ms`);
    console.log(`  • Mean Latency:       ${metrics.meanLatencyMs}ms`);
    console.log('─────────────────────────────────────────────────────────\n');
    return metrics;
}
