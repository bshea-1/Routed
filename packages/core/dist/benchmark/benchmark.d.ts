import { HybridRouter } from '../router/hybrid-router.js';
export interface BenchmarkCase {
    id: string;
    category: 'exact-match' | 'synonym' | 'technical-jargon' | 'abbreviation' | 'indirect-intent' | 'multi-skill' | 'no-skill' | 'irrelevant-trap' | 'multilingual';
    prompt: string;
    expectedSkills: string[];
    description: string;
}
export interface BenchmarkMetrics {
    totalCases: number;
    top1Accuracy: number;
    top3Recall: number;
    noSkillAccuracy: number;
    meanLatencyMs: number;
    medianLatencyMs: number;
    passedCount: number;
    failedCount: number;
    results: Array<{
        id: string;
        prompt: string;
        category: string;
        expected: string[];
        actual: string[];
        isTop1Match: boolean;
        isTop3Match: boolean;
        latencyMs: number;
    }>;
}
export declare const BENCHMARK_CASES: BenchmarkCase[];
export declare function runBenchmark(router: HybridRouter, customCases?: BenchmarkCase[]): Promise<BenchmarkMetrics>;
//# sourceMappingURL=benchmark.d.ts.map