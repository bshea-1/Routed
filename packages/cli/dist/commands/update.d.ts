export interface UpdateCommandOptions {
    check?: boolean;
    yes?: boolean;
    json?: boolean;
}
export interface ReleaseInfo {
    tagName: string;
    version: string;
    name: string;
    publishedAt: string;
    body: string;
    htmlUrl: string;
}
export declare function fetchLatestRelease(): Promise<ReleaseInfo | null>;
export declare function runUpdateCommand(options?: UpdateCommandOptions): Promise<void>;
//# sourceMappingURL=update.d.ts.map