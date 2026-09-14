import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
export declare class ClineAdapter implements HostAdapter {
    id: "cline";
    name: string;
    private getPrimaryMcpSettingsPath;
    private getAllCandidateMcpPaths;
    private getSkillDirPath;
    private getSkillFilePath;
    detectHost(): boolean;
    isAdapterInstalled(): boolean;
    installAdapter(): Promise<AdapterInstallResult>;
    uninstallAdapter(): Promise<AdapterUninstallResult>;
    getStatus(): AdapterStatus;
}
//# sourceMappingURL=cline.d.ts.map