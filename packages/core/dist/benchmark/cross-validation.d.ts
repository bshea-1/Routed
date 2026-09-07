import { BenchmarkCase, CrossValidationReport, FoldResult, GridSearchOptions } from '../types.js';
import { PrecomputedSignalsEngine } from './precomputed-signals.js';
export declare class CrossValidator {
    private gridSearchEngine;
    constructor();
    runStratifiedKFold(cases: BenchmarkCase[], signalsEngine: PrecomputedSignalsEngine, kFolds?: number, options?: GridSearchOptions, onFoldComplete?: (foldIndex: number, totalFolds: number, foldResult: FoldResult) => void): CrossValidationReport;
    private partitionStratifiedFolds;
}
//# sourceMappingURL=cross-validation.d.ts.map