import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';
export declare class McpAdapter implements HostAdapter {
    id: "mcp";
    name: string;
    private getClaudeDesktopConfigPath;
    private getCursorMcpConfigPath;
    private getActiveConfigPaths;
    detectHost(): boolean;
    isAdapterInstalled(): boolean;
    installAdapter(): Promise<AdapterInstallResult>;
    uninstallAdapter(): Promise<AdapterUninstallResult>;
    getStatus(): AdapterStatus;
}
//# sourceMappingURL=mcp.d.ts.map