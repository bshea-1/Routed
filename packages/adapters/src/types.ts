import { HostId, SkillMetadata } from '../../core/dist/index.js';
export interface AdapterStatus {
    hostId: HostId;
    name: string;
    isHostDetected: boolean;
    isAdapterInstalled: boolean;
    adapterPath?: string;
    version?: string;
}
export interface AdapterInstallResult {
    hostId: HostId;
    name: string;
    success: boolean;
    adapterPath: string;
    message: string;
    alreadyInstalled?: boolean;
}
export interface AdapterUninstallResult {
    hostId: HostId;
    name: string;
    success: boolean;
    adapterPath: string;
    message: string;
    notInstalled?: boolean;
}
export interface ResolvedSkill {
    logicalSkill: SkillMetadata;
    targetPath: string;
    isNativeToHost: boolean;
    originalHost: HostId;
}
export interface HostAdapter {
    id: HostId;
    name: string;
    detectHost(): boolean;
    isAdapterInstalled(): boolean;
    installAdapter(): Promise<AdapterInstallResult>;
    uninstallAdapter(): Promise<AdapterUninstallResult>;
    getStatus(): AdapterStatus;
}
