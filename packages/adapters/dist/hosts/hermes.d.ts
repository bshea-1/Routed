import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
export declare class HermesAdapter implements HostAdapter {
    id: "hermes";
    name: string;
    private getHermesDir;
    private getRoutedHermesDir;
    detectHost(): boolean;
    isAdapterInstalled(): boolean;
    installAdapter(): Promise<AdapterInstallResult>;
    uninstallAdapter(): Promise<AdapterUninstallResult>;
    getStatus(): AdapterStatus;
}
//# sourceMappingURL=hermes.d.ts.map