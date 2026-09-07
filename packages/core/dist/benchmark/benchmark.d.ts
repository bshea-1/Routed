import { HybridRouter } from '../router/hybrid-router.js';
import { BenchmarkCase, BenchmarkMetrics, HybridScorerWeights } from '../types.js';
export { BenchmarkCase, BenchmarkMetrics } from '../types.js';
export { REPRESENTATIVE_BENCHMARK_DATASET } from './dataset.js';
export declare const BENCHMARK_CASES: BenchmarkCase[];
export interface RunBenchmarkOptions {
    weights?: HybridScorerWeights;
    threshold?: number;
    topK?: number;
    allowNoSkill?: boolean;
}
export declare function runBenchmark(router: HybridRouter, customCases?: BenchmarkCase[], options?: RunBenchmarkOptions): Promise<BenchmarkMetrics>;
//# sourceMappingURL=benchmark.d.ts.map