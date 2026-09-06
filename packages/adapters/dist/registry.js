import { AntigravityAdapter } from './hosts/antigravity.js';
import { ClaudeCodeAdapter } from './hosts/claude-code.js';
import { OpenCodeAdapter } from './hosts/opencode.js';
import { CursorAdapter } from './hosts/cursor.js';
import { CodexAdapter } from './hosts/codex.js';
import { McpAdapter } from './hosts/mcp.js';
import { LmStudioAdapter } from './hosts/lmstudio.js';
import { OllamaAdapter } from './hosts/ollama.js';
import { WindsurfAdapter } from './hosts/windsurf.js';
import { ContinueAdapter } from './hosts/continue.js';
export class AdapterRegistry {
    adapters = new Map();
    constructor() {
        this.registerDefaults();
    }
    registerDefaults() {
        const list = [
            new AntigravityAdapter(),
            new ClaudeCodeAdapter(),
            new OpenCodeAdapter(),
            new CursorAdapter(),
            new CodexAdapter(),
            new McpAdapter(),
            new LmStudioAdapter(),
            new OllamaAdapter(),
            new WindsurfAdapter(),
            new ContinueAdapter(),
        ];
        for (const a of list) {
            this.adapters.set(a.id, a);
        }
    }
    register(adapter) {
        this.adapters.set(adapter.id, adapter);
    }
    getAdapter(id) {
        return this.adapters.get(id);
    }
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }
    getStatusList() {
        return this.getAllAdapters().map((a) => a.getStatus());
    }
    async install(hostId) {
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
    async uninstall(hostId) {
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
    async installDetected() {
        const results = [];
        for (const adapter of this.getAllAdapters()) {
            if (adapter.detectHost()) {
                const res = await adapter.installAdapter();
                results.push(res);
            }
        }
        return results;
    }
    async uninstallAll() {
        const results = [];
        for (const adapter of this.getAllAdapters()) {
            if (adapter.isAdapterInstalled()) {
                const res = await adapter.uninstallAdapter();
                results.push(res);
            }
        }
        return results;
    }
}
//# sourceMappingURL=registry.js.map