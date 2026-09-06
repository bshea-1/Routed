import { RouteResult } from '@routed/core';
export interface RouteCommandOptions {
    prompt: string;
    explain?: boolean;
    json?: boolean;
    topK?: number;
    threshold?: number;
    autoScan?: boolean;
}
export declare function runRoute(options: RouteCommandOptions): Promise<RouteResult>;
//# sourceMappingURL=route.d.ts.map