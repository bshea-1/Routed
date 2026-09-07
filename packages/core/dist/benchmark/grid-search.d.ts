import { BenchmarkCase, GridSearchOptions, GridSearchResult, TunableParameters } from '../types.js';
import { PrecomputedSignalsEngine } from './precomputed-signals.js';
export declare class GridSearchEngine {
    search(cases: BenchmarkCase[], signalsEngine: PrecomputedSignalsEngine, options?: GridSearchOptions): GridSearchResult;
    generateParameterGrid(step: number, thresholds: number[], options?: GridSearchOptions): TunableParameters[];
    private generateFineGrid;
}
//# sourceMappingURL=grid-search.d.ts.map