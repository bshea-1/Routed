import { HostId } from '../../core/dist/index.js';
import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from './types.js';
export declare class AdapterRegistry {
    private adapters;
    constructor();
    private registerDefaults;
    register(adapter: HostAdapter): void;
    getAdapter(id: HostId): HostAdapter | undefined;
    getAllAdapters(): HostAdapter[];
    getStatusList(): AdapterStatus[];
    install(hostId: HostId): Promise<AdapterInstallResult>;
    uninstall(hostId: HostId): Promise<AdapterUninstallResult>;
    installDetected(): Promise<AdapterInstallResult[]>;
    uninstallAll(): Promise<AdapterUninstallResult[]>;
}
//# sourceMappingURL=registry.d.ts.map