import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
export declare class LmStudioAdapter implements HostAdapter {
    id: "lmstudio";
    name: string;
    private getCandidateDirs;
    private getMcpConfigPath;
    detectHost(): boolean;
    isAdapterInstalled(): boolean;
    installAdapter(): Promise<AdapterInstallResult>;
    uninstallAdapter(): Promise<AdapterUninstallResult>;
    getStatus(): AdapterStatus;
}
//# sourceMappingURL=lmstudio.d.ts.map