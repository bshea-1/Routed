import { BenchmarkMetrics } from '../../../core/dist/index.js';
export interface BenchmarkCommandOptions {
    json?: boolean;
    dataset?: string;
    weights?: string;
    gridSearch?: boolean;
    kFold?: number;
    apply?: boolean;
}
export declare function runBenchmarkCommand(options?: BenchmarkCommandOptions): Promise<BenchmarkMetrics | void>;
//# sourceMappingURL=benchmark.d.ts.map