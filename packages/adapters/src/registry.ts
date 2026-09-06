import { HostId } from '@routed/core';
import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from './types.js';
import { AntigravityAdapter } from './hosts/antigravity.js';
import { ClaudeCodeAdapter } from './hosts/claude-code.js';
import { OpenCodeAdapter } from './hosts/opencode.js';
import { CursorAdapter } from './hosts/cursor.js';
import { CodexAdapter } from './hosts/codex.js';
export class AdapterRegistry {
    private adapters = new Map<HostId, HostAdapter>();
    constructor() {
        this.registerDefaults();
    }
    private registerDefaults(): void {
        const list: HostAdapter[] = [
            new AntigravityAdapter(),
            new ClaudeCodeAdapter(),
            new OpenCodeAdapter(),
            new CursorAdapter(),
            new CodexAdapter(),
        ];
        for (const a of list) {
            this.adapters.set(a.id, a);
        }
    }
    public register(adapter: HostAdapter): void {
        this.adapters.set(adapter.id, adapter);
    }
    public getAdapter(id: HostId): HostAdapter | undefined {
        return this.adapters.get(id);
    }
    public getAllAdapters(): HostAdapter[] {
        return Array.from(this.adapters.values());
    }
    public getStatusList(): AdapterStatus[] {
        return this.getAllAdapters().map((a) => a.getStatus());
    }
    public async install(hostId: HostId): Promise<AdapterInstallResult> {
        const adapter = this.getAdapter(hostId);
        if (!adapter) {
            return {
                hostId,
                name: hostId,
                success: false,
                adapterPath: '',
                message: `Unknown host environment: ${hostId}`,
            };
        }
        return adapter.installAdapter();
    }
    public async uninstall(hostId: HostId): Promise<AdapterUninstallResult> {
        const adapter = this.getAdapter(hostId);
        if (!adapter) {
            return {
                hostId,
                name: hostId,
                success: false,
                adapterPath: '',
                message: `Unknown host environment: ${hostId}`,
            };
        }
        return adapter.uninstallAdapter();
    }
    public async installDetected(): Promise<AdapterInstallResult[]> {
        const results: AdapterInstallResult[] = [];
        for (const adapter of this.getAllAdapters()) {
            if (adapter.detectHost()) {
                const res = await adapter.installAdapter();
                results.push(res);
            }
        }
        return results;
    }
    public async uninstallAll(): Promise<AdapterUninstallResult[]> {
        const results: AdapterUninstallResult[] = [];
        for (const adapter of this.getAllAdapters()) {
            if (adapter.isAdapterInstalled()) {
                const res = await adapter.uninstallAdapter();
                results.push(res);
            }
        }
        return results;
    }
}
