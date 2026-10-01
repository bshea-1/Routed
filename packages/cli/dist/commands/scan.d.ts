import { ScanResult } from '../../../core/dist/index.js';
export interface ScanOptions {
    workspace?: string;
    json?: boolean;
    quiet?: boolean;
    prune?: boolean;
}
export declare function runScan(options?: ScanOptions): ScanResult;
//# sourceMappingURL=scan.d.ts.map