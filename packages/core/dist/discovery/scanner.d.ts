import { HostEnvironment, HostId, SkillMetadata } from '../types.js';
export interface ScannerOptions {
    maxDepth?: number;
    includeBuiltin?: boolean;
    customPaths?: {
        host: HostId;
        path: string;
    }[];
}
export declare class SkillScanner {
    private visitedPaths;
    scanEnvironments(environments: HostEnvironment[], options?: ScannerOptions): SkillMetadata[];
    private crawlDirectory;
}
//# sourceMappingURL=scanner.d.ts.map