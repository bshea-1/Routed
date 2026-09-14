import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
export declare class ClineAdapter implements HostAdapter {
    id: "cline";
    name: string;
    private getSupportedEditorNames;
    private getPrimaryMcpSettingsPath;
    private getAllCandidateMcpPaths;
    private getGlobalWorkflowPath;
    private getWorkspaceWorkflowPath;
    private getGlobalClineRulesPath;
    private getSkillDirPath;
    private getSkillFilePath;
    private generateWorkflowContent;
    private generateClineRulesContent;
    detectHost(): boolean;
    isAdapterInstalled(): boolean;
    installAdapter(): Promise<AdapterInstallResult>;
    uninstallAdapter(): Promise<AdapterUninstallResult>;
    getStatus(): AdapterStatus;
}
//# sourceMappingURL=cline.d.ts.map