export interface UninstallItem {
    type: 'adapter' | 'database' | 'model' | 'logs' | 'config' | 'directory';
    path: string;
    description: string;
    exists: boolean;
}
export interface UninstallPlan {
    itemsToRemove: UninstallItem[];
    protectedPaths: string[];
    totalBytesEstimate: number;
}
export interface UninstallResult {
    success: boolean;
    removedItems: string[];
    failedItems: string[];
    message: string;
}
export declare class RoutedUninstaller {
    planUninstall(adapterPaths?: string[]): UninstallPlan;
    executeUninstall(adapterPaths?: string[]): UninstallResult;
}
//# sourceMappingURL=uninstaller.d.ts.map