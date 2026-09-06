export interface RoutedPaths {
    rootDir: string;
    configPath: string;
    databasePath: string;
    learningDbPath: string;
    logsDir: string;
    adaptersDir: string;
    modelDir: string;
}
export declare function getRoutedDataDir(): string;
export declare function getPaths(): RoutedPaths;
export declare function ensureDataDirectories(): RoutedPaths;
//# sourceMappingURL=paths.d.ts.map