export interface AdaptersCommandOptions {
    action?: 'list' | 'install' | 'uninstall' | 'test';
    host?: string;
    json?: boolean;
}
export declare function runAdaptersCommand(options?: AdaptersCommandOptions): Promise<void>;
//# sourceMappingURL=adapters.d.ts.map