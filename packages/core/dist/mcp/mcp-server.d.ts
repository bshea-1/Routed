import { HybridRouter } from '../router/hybrid-router.js';
import { RoutedDatabase } from '../storage/database.js';
import { SkillScanner } from '../discovery/scanner.js';
import { LearningStore } from '../learning/learning-store.js';
export interface McpServerOptions {
    router?: HybridRouter;
    db?: RoutedDatabase;
    scanner?: SkillScanner;
    learningStore?: LearningStore;
    version?: string;
}
export declare class McpServer {
    private router;
    private db;
    private scanner;
    private learningStore;
    private version;
    constructor(options?: McpServerOptions);
    startStdio(): void;
    handleMessage(request: Record<string, any>): Promise<Record<string, any> | null>;
    private executeTool;
}
//# sourceMappingURL=mcp-server.d.ts.map