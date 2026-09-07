import { RoutedDatabase, BM25Engine, SemanticEngine, PrecomputedSignalsEngine, CrossValidator, loadBenchmarkDataset, DEFAULT_WEIGHTS, } from '../../../core/dist/index.js';
export async function runTuneCommand(options = {}) {
    const db = new RoutedDatabase();
    if (options.reset) {
        db.clearRoutingWeights();
        if (options.json) {
            console.log(JSON.stringify({ reset: true, message: 'Routing weights reset to factory defaults.' }, null, 2));
        }
        else {
            console.log('\n[OK] Routing scoring weights reset to standard factory defaults.');
            console.log('     Baseline: 50% Semantic / 35% BM25 / 10% Exact / 5% Metadata (Threshold: 0.20)\n');
        }
        return null;
    }
    const skills = db.getAllSkills();
    if (skills.length === 0) {
        console.error('Error: No skills in database. Run `routed scan` first.');
        process.exit(1);
    }
    const cases = loadBenchmarkDataset(options.dataset);
    const kFolds = options.folds ?? 5;
    const gridStep = options.gridStep ?? 0.05;
    const metric = options.metric ?? 'composite';
    if (!options.json) {
        console.log('\n═════════════════════════════════════════════════════════════════');
        console.log(' Routed Parameter Grid Search & K-Fold Cross-Validation');
        console.log('═════════════════════════════════════════════════════════════════');
        console.log(` Skills Indexed:       ${skills.length}`);
        console.log(` Benchmark Cases:      ${cases.length} across 9 categories`);
        console.log(` Stratified Folds:     ${kFolds}-Fold Cross-Validation`);
        console.log(` Parameter Grid Step:  ${gridStep} (simplex normalization: sum = 1.0)`);
        console.log(` Optimization Metric:  ${metric.toUpperCase()}`);
        console.log('─────────────────────────────────────────────────────────────────\n');
        process.stdout.write(' Phase 1/2: Precomputing retrieval signals matrix... ');
    }
    const bm25Engine = new BM25Engine();
    bm25Engine.index(skills);
    const semanticEngine = new SemanticEngine();
    await semanticEngine.init();
    const signalsEngine = new PrecomputedSignalsEngine();
    const tPrecompute0 = performance.now();
    await signalsEngine.precomputeAll(cases, skills, db, semanticEngine, bm25Engine);
    const precomputeMs = Math.round(performance.now() - tPrecompute0);
    if (!options.json) {
        console.log(`[DONE] (${precomputeMs}ms)\n`);
        console.log(' Phase 2/2: Running Stratified K-Fold Cross-Validation & Grid Sweep:');
    }
    const validator = new CrossValidator();
    const gridOptions = {
        gridStep,
        coarseToFine: options.coarseToFine ?? true,
        metric,
    };
    const report = validator.runStratifiedKFold(cases, signalsEngine, kFolds, gridOptions, (foldIdx, totalFolds, foldResult) => {
        if (!options.json) {
            const trainAcc = `${foldResult.trainMetrics.top1Accuracy.toFixed(1)}%`;
            const valAcc = `${foldResult.valMetrics.top1Accuracy.toFixed(1)}%`;
            const baseValAcc = `${foldResult.baselineValMetrics.top1Accuracy.toFixed(1)}%`;
            const gap = `${foldResult.generalizationGap >= 0 ? '+' : ''}${foldResult.generalizationGap.toFixed(1)}%`;
            const p = foldResult.bestTrainParams;
            const weightsStr = `[S:${Math.round(p.semanticWeight * 100)}% B:${Math.round(p.lexicalWeight * 100)}% E:${Math.round(p.exactWeight * 100)}% M:${Math.round(p.metadataWeight * 100)}%]`;
            console.log(`   • Fold ${foldIdx}/${totalFolds} (${foldResult.valCasesCount} val cases): Train ${trainAcc} → Val ${valAcc} (Base: ${baseValAcc} | Gap: ${gap.padStart(5)}) ${weightsStr}`);
        }
    });
    const rec = report.recommendedParams;
    const optimalWeights = {
        semanticWeight: rec.semanticWeight,
        lexicalWeight: rec.lexicalWeight,
        exactWeight: rec.exactWeight,
        metadataWeight: rec.metadataWeight,
    };
    let applied = false;
    if (options.apply) {
        db.setRoutingWeights(optimalWeights, {
            threshold: rec.threshold,
            oofAccuracy: report.oofMetrics.top1Accuracy,
            meanValAccuracy: report.meanValAccuracy,
            generalizationGap: report.meanGeneralizationGap,
            kFolds,
            totalCases: cases.length,
        });
        db.saveTuneReport({
            timestamp: report.timestamp,
            kFolds,
            totalCases: cases.length,
            testedCombinations: report.folds.length * 100,
            optimalWeights,
            optimalThreshold: rec.threshold ?? 0.20,
            crossValidation: report,
            appliedToDatabase: true,
        });
        applied = true;
    }
    if (options.json) {
        console.log(JSON.stringify({ ...report, appliedToDatabase: applied }, null, 2));
        return report;
    }
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log(' Cross-Validation Generalization Summary:');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`   • Mean Train Accuracy:        ${report.meanTrainAccuracy.toFixed(1)}%`);
    console.log(`   • Mean Validation Accuracy:   ${report.meanValAccuracy.toFixed(1)}% (Out-of-Fold)`);
    console.log(`   • Generalization Gap:         ${report.meanGeneralizationGap.toFixed(1)}% (Train - Val)`);
    console.log(`   • Fold Variance (StdDev):     ±${report.valAccuracyStdDev.toFixed(1)}%`);
    console.log(`   • Total Out-of-Fold Recall:   ${report.oofMetrics.top3Recall.toFixed(1)}% (Top-3)`);
    console.log(`   • Mean Reciprocal Rank (MRR): ${report.oofMetrics.mrr.toFixed(1)}%`);
    console.log(`   • No-Skill Precision:         ${report.oofMetrics.noSkillAccuracy.toFixed(1)}%`);
    console.log(`   • Evaluation Duration:        ${report.durationMs}ms`);
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log(' Scoring Parameter Comparison:');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`   Baseline Weights:   ${Math.round(DEFAULT_WEIGHTS.semanticWeight * 100)}% Semantic | ${Math.round(DEFAULT_WEIGHTS.lexicalWeight * 100)}% BM25 | ${Math.round(DEFAULT_WEIGHTS.exactWeight * 100)}% Exact | ${Math.round(DEFAULT_WEIGHTS.metadataWeight * 100)}% Meta (Thresh: 0.20)`);
    console.log(`   Baseline OOF Score: ${report.baselineOofMetrics.top1Accuracy.toFixed(1)}% Top-1 Accuracy | ${report.baselineOofMetrics.top3Recall.toFixed(1)}% Top-3 Recall`);
    console.log(`   Empirical Weights:  ${Math.round(rec.semanticWeight * 100)}% Semantic | ${Math.round(rec.lexicalWeight * 100)}% BM25 | ${Math.round(rec.exactWeight * 100)}% Exact | ${Math.round(rec.metadataWeight * 100)}% Meta (Thresh: ${rec.threshold?.toFixed(2) ?? '0.20'})`);
    console.log(`   Empirical Score:    ${report.recommendedMetrics.top1Accuracy.toFixed(1)}% Top-1 Accuracy | ${report.recommendedMetrics.top3Recall.toFixed(1)}% Top-3 Recall`);
    const deltaTop1 = report.recommendedMetrics.top1Accuracy - report.baselineOofMetrics.top1Accuracy;
    const sign = deltaTop1 >= 0 ? '+' : '';
    console.log(`   Empirical Delta:    ${sign}${deltaTop1.toFixed(1)}% Top-1 improvement over default baseline`);
    console.log('─────────────────────────────────────────────────────────────────');
    if (applied) {
        console.log('\n[OK] Optimal empirical weights have been applied to SQLite index.db!');
        console.log('     All future `routed route` queries will dynamically execute with these weights.');
    }
    else {
        console.log('\n[TIP] To activate these empirical weights for all routing queries, run:');
        console.log('      routed tune --apply');
        console.log('      To reset to defaults at any time: routed tune --reset\n');
    }
    return report;
}
//# sourceMappingURL=tune.js.map