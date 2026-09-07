import { evaluatePredictions, computeMetricScore } from './metrics.js';
import { DEFAULT_WEIGHTS } from '../scorer/hybrid-scorer.js';
export class GridSearchEngine {
    search(cases, signalsEngine, options = {}) {
        const t0 = performance.now();
        const metric = options.metric || 'composite';
        const step = options.gridStep || 0.05;
        const thresholds = options.thresholds || [0.15, 0.20, 0.25];
        const topNCandidates = options.topNCandidates || 10;
        // Generate parameter grid
        const paramSets = this.generateParameterGrid(step, thresholds, options);
        let bestScore = -Infinity;
        let bestCandidate = null;
        const allCandidates = [];
        // Baseline evaluation
        const baselineParams = {
            semanticWeight: DEFAULT_WEIGHTS.semanticWeight,
            lexicalWeight: DEFAULT_WEIGHTS.lexicalWeight,
            exactWeight: DEFAULT_WEIGHTS.exactWeight,
            metadataWeight: DEFAULT_WEIGHTS.metadataWeight,
            threshold: 0.20,
        };
        const baselinePreds = signalsEngine.evaluateWithParams(cases, baselineParams);
        const baselineEval = evaluatePredictions(cases, baselinePreds);
        const baselineScore = computeMetricScore(baselineEval.metrics, metric);
        const baselineCandidate = {
            params: baselineParams,
            metrics: baselineEval.metrics,
            score: baselineScore,
        };
        // Sweep all configurations
        for (const params of paramSets) {
            const preds = signalsEngine.evaluateWithParams(cases, params);
            const { metrics } = evaluatePredictions(cases, preds);
            const score = computeMetricScore(metrics, metric);
            const candidate = {
                params,
                metrics,
                score,
            };
            allCandidates.push(candidate);
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }
        // Coarse-to-fine refinement if requested
        if (options.coarseToFine && bestCandidate) {
            const fineParams = this.generateFineGrid(bestCandidate.params, 0.02, thresholds);
            for (const params of fineParams) {
                const preds = signalsEngine.evaluateWithParams(cases, params);
                const { metrics } = evaluatePredictions(cases, preds);
                const score = computeMetricScore(metrics, metric);
                const candidate = { params, metrics, score };
                allCandidates.push(candidate);
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            }
        }
        allCandidates.sort((a, b) => b.score - a.score);
        const topCandidates = allCandidates.slice(0, topNCandidates);
        const duration = performance.now() - t0;
        return {
            bestCandidate: bestCandidate || baselineCandidate,
            baselineCandidate,
            topCandidates,
            totalConfigurationsTested: allCandidates.length,
            searchDurationMs: Math.round(duration * 10) / 10,
            metricUsed: metric,
        };
    }
    generateParameterGrid(step, thresholds, options = {}) {
        const minSem = options.minSemanticWeight ?? 0.10;
        const maxSem = options.maxSemanticWeight ?? 0.70;
        const minLex = options.minLexicalWeight ?? 0.15;
        const maxLex = options.maxLexicalWeight ?? 0.65;
        const minExact = options.minExactWeight ?? 0.05;
        const maxExact = options.maxExactWeight ?? 0.25;
        const minMeta = options.minMetadataWeight ?? 0.00;
        const maxMeta = options.maxMetadataWeight ?? 0.20;
        const results = [];
        // Sweep on discrete grid
        for (let sem = minSem; sem <= maxSem + 1e-6; sem += step) {
            for (let lex = minLex; lex <= maxLex + 1e-6; lex += step) {
                for (let exact = minExact; exact <= maxExact + 1e-6; exact += step) {
                    const remaining = 1.0 - (sem + lex + exact);
                    const meta = Math.round(remaining * 100) / 100;
                    if (meta >= minMeta - 1e-6 && meta <= maxMeta + 1e-6) {
                        for (const thresh of thresholds) {
                            results.push({
                                semanticWeight: Math.round(sem * 100) / 100,
                                lexicalWeight: Math.round(lex * 100) / 100,
                                exactWeight: Math.round(exact * 100) / 100,
                                metadataWeight: meta,
                                threshold: thresh,
                            });
                        }
                    }
                }
            }
        }
        return results;
    }
    generateFineGrid(center, fineStep, thresholds) {
        const results = [];
        const offsets = [-fineStep, 0, fineStep];
        for (const dSem of offsets) {
            for (const dLex of offsets) {
                for (const dExact of offsets) {
                    const sem = center.semanticWeight + dSem;
                    const lex = center.lexicalWeight + dLex;
                    const exact = center.exactWeight + dExact;
                    if (sem < 0.05 || lex < 0.05 || exact < 0.05)
                        continue;
                    const remaining = 1.0 - (sem + lex + exact);
                    const meta = Math.round(remaining * 1000) / 1000;
                    if (meta >= 0 && meta <= 0.30) {
                        for (const thresh of thresholds) {
                            results.push({
                                semanticWeight: Math.round(sem * 1000) / 1000,
                                lexicalWeight: Math.round(lex * 1000) / 1000,
                                exactWeight: Math.round(exact * 1000) / 1000,
                                metadataWeight: meta,
                                threshold: thresh,
                            });
                        }
                    }
                }
            }
        }
        return results;
    }
}
//# sourceMappingURL=grid-search.js.map