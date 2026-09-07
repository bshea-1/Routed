import { CrossValidationReport } from '../../../core/dist/index.js';
export interface TuneCommandOptions {
    folds?: number;
    gridStep?: number;
    coarseToFine?: boolean;
    metric?: 'composite' | 'top1' | 'top3' | 'mrr' | 'f1';
    dataset?: string;
    apply?: boolean;
    reset?: boolean;
    json?: boolean;
}
export declare function runTuneCommand(options?: TuneCommandOptions): Promise<CrossValidationReport | null>;
//# sourceMappingURL=tune.d.ts.map