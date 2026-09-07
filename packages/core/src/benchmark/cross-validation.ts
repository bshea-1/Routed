import {
    BenchmarkCase,
    CrossValidationReport,
    FoldResult,
    GridSearchOptions,
    TunableParameters,
} from '../types.js';
import { PrecomputedSignalsEngine } from './precomputed-signals.js';
import { GridSearchEngine } from './grid-search.js';
import { evaluatePredictions, computeStandardDeviation } from './metrics.js';
import { DEFAULT_WEIGHTS } from '../scorer/hybrid-scorer.js';

export class CrossValidator {
    private gridSearchEngine: GridSearchEngine;

    constructor() {
        this.gridSearchEngine = new GridSearchEngine();
    }

    public runStratifiedKFold(
        cases: BenchmarkCase[],
        signalsEngine: PrecomputedSignalsEngine,
        kFolds = 5,
        options: GridSearchOptions = {},
        onFoldComplete?: (foldIndex: number, totalFolds: number, foldResult: FoldResult) => void
    ): CrossValidationReport {
        const t0 = performance.now();
        const folds = this.partitionStratifiedFolds(cases, kFolds);

        const foldResults: FoldResult[] = [];
        const oofPredictions: Array<{ actual: string[]; isNoSkill: boolean }> = new Array(cases.length);
        const baselineOofPredictions: Array<{ actual: string[]; isNoSkill: boolean }> = new Array(cases.length);

        const baselineParams: TunableParameters = {
            semanticWeight: DEFAULT_WEIGHTS.semanticWeight,
            lexicalWeight: DEFAULT_WEIGHTS.lexicalWeight,
            exactWeight: DEFAULT_WEIGHTS.exactWeight,
            metadataWeight: DEFAULT_WEIGHTS.metadataWeight,
            threshold: 0.20,
        };

        const parameterCounts = new Map<string, { count: number; params: TunableParameters; totalValAcc: number }>();

        for (let foldIdx = 0; foldIdx < kFolds; foldIdx++) {
            const valIndices = folds[foldIdx];
            const trainIndices: number[] = [];
            for (let f = 0; f < kFolds; f++) {
                if (f !== foldIdx) {
                    trainIndices.push(...folds[f]);
                }
            }

            const trainCases = trainIndices.map((idx) => cases[idx]);
            const valCases = valIndices.map((idx) => cases[idx]);

            // Grid search on training set
            const gridResult = this.gridSearchEngine.search(trainCases, signalsEngine, options);
            const bestTrainParams = gridResult.bestCandidate.params;
            const trainMetrics = gridResult.bestCandidate.metrics;

            // Evaluate on unseen validation fold
            const valPreds = signalsEngine.evaluateWithParams(valCases, bestTrainParams);
            const valEval = evaluatePredictions(valCases, valPreds);

            // Evaluate baseline on unseen validation fold
            const baseValPreds = signalsEngine.evaluateWithParams(valCases, baselineParams);
            const baseValEval = evaluatePredictions(valCases, baseValPreds);

            // Record out-of-fold predictions
            for (let v = 0; v < valIndices.length; v++) {
                const origIdx = valIndices[v];
                oofPredictions[origIdx] = valPreds[v];
                baselineOofPredictions[origIdx] = baseValPreds[v];
            }

            const genGap = Math.round((trainMetrics.top1Accuracy - valEval.metrics.top1Accuracy) * 10) / 10;

            const foldResult: FoldResult = {
                foldIndex: foldIdx + 1,
                trainCasesCount: trainCases.length,
                valCasesCount: valCases.length,
                bestTrainParams,
                trainMetrics,
                valMetrics: valEval.metrics,
                baselineValMetrics: baseValEval.metrics,
                generalizationGap: genGap,
            };

            foldResults.push(foldResult);

            // Track parameter frequency and validation performance
            const key = `${bestTrainParams.semanticWeight}_${bestTrainParams.lexicalWeight}_${bestTrainParams.exactWeight}_${bestTrainParams.metadataWeight}_${bestTrainParams.threshold}`;
            const existing = parameterCounts.get(key);
            if (!existing) {
                parameterCounts.set(key, { count: 1, params: bestTrainParams, totalValAcc: valEval.metrics.top1Accuracy });
            } else {
                existing.count++;
                existing.totalValAcc += valEval.metrics.top1Accuracy;
            }

            if (onFoldComplete) {
                onFoldComplete(foldIdx + 1, kFolds, foldResult);
            }
        }

        const meanTrainAccuracy =
            Math.round(
                (foldResults.reduce((sum, f) => sum + f.trainMetrics.top1Accuracy, 0) / kFolds) * 10
            ) / 10;
        const meanValAccuracy =
            Math.round(
                (foldResults.reduce((sum, f) => sum + f.valMetrics.top1Accuracy, 0) / kFolds) * 10
            ) / 10;
        const meanGeneralizationGap =
            Math.round(
                (foldResults.reduce((sum, f) => sum + f.generalizationGap, 0) / kFolds) * 10
            ) / 10;
        const valAccuracyStdDev =
            Math.round(
                computeStandardDeviation(foldResults.map((f) => f.valMetrics.top1Accuracy)) * 10
            ) / 10;

        // Full out-of-fold evaluation
        const oofEval = evaluatePredictions(cases, oofPredictions);
        const baselineOofEval = evaluatePredictions(cases, baselineOofPredictions);

        // Pick recommended parameters: the one winning the most folds or highest aggregate val score
        let bestParamCandidate = baselineParams;
        let maxValAcc = -Infinity;
        for (const entry of parameterCounts.values()) {
            const avgAcc = entry.totalValAcc / entry.count;
            if (avgAcc > maxValAcc) {
                maxValAcc = avgAcc;
                bestParamCandidate = entry.params;
            }
        }

        // Full dataset evaluation with recommended parameters
        const recPreds = signalsEngine.evaluateWithParams(cases, bestParamCandidate);
        const recEval = evaluatePredictions(cases, recPreds);

        const duration = performance.now() - t0;

        return {
            kFolds,
            totalCases: cases.length,
            folds: foldResults,
            meanTrainAccuracy,
            meanValAccuracy,
            meanGeneralizationGap,
            valAccuracyStdDev,
            oofMetrics: oofEval.metrics,
            recommendedParams: bestParamCandidate,
            recommendedMetrics: recEval.metrics,
            baselineOofMetrics: baselineOofEval.metrics,
            durationMs: Math.round(duration * 10) / 10,
            timestamp: new Date().toISOString(),
        };
    }

    private partitionStratifiedFolds(cases: BenchmarkCase[], k: number): number[][] {
        const folds: number[][] = Array.from({ length: k }, () => []);

        // Group case indices by category
        const categoryMap = new Map<string, number[]>();
        for (let i = 0; i < cases.length; i++) {
            const cat = cases[i].category;
            const list = categoryMap.get(cat) || [];
            list.push(i);
            categoryMap.set(cat, list);
        }

        // Round-robin distribution across folds for each category
        for (const indices of categoryMap.values()) {
            for (let i = 0; i < indices.length; i++) {
                const foldIdx = i % k;
                folds[foldIdx].push(indices[i]);
            }
        }

        return folds;
    }
}
