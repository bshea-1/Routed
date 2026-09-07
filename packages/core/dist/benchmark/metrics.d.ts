import { BenchmarkCase, EvaluationMetrics } from '../types.js';
export interface QueryEvaluationResult {
    caseId: string;
    prompt: string;
    category: string;
    expected: string[];
    actual: string[];
    isTop1Match: boolean;
    isTop3Match: boolean;
    isTop5Match: boolean;
    reciprocalRank: number;
    isNoSkillMatch: boolean;
    latencyMs: number;
}
export declare function evaluatePredictions(cases: BenchmarkCase[], predictions: Array<{
    actual: string[];
    isNoSkill: boolean;
    latencyMs?: number;
}>): {
    metrics: EvaluationMetrics;
    details: QueryEvaluationResult[];
};
export declare function computeMetricScore(metrics: EvaluationMetrics, metric?: 'composite' | 'top1' | 'top3' | 'mrr' | 'f1'): number;
export declare function computeStandardDeviation(values: number[]): number;
//# sourceMappingURL=metrics.d.ts.map