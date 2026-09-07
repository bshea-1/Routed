export interface HermesCommandOptions {
    subcommand?: string;
    prompt?: string;
    format?: 'json' | 'xml';
}
export declare function runHermesCommand(options: HermesCommandOptions): Promise<void>;
//# sourceMappingURL=hermes.d.ts.map