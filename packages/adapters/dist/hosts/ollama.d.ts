import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
export declare class OllamaAdapter implements HostAdapter {
    id: "ollama";
    name: string;
    private getOllamaDir;
    private getRoutedOllamaDir;
    detectHost(): boolean;
    isAdapterInstalled(): boolean;
    installAdapter(): Promise<AdapterInstallResult>;
    uninstallAdapter(): Promise<AdapterUninstallResult>;
    getStatus(): AdapterStatus;
}
//# sourceMappingURL=ollama.d.ts.map