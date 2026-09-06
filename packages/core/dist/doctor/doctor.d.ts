import { RoutedDatabase } from '../storage/database.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
export interface DoctorCheck {
    id: string;
    category: 'system' | 'database' | 'model' | 'adapters' | 'environments';
    name: string;
    status: 'ok' | 'warn' | 'error';
    message: string;
    details?: string;
    fixable?: boolean;
}
export interface DoctorReport {
    timestamp: string;
    allOk: boolean;
    checks: DoctorCheck[];
    fixedCount?: number;
}
export declare class RoutedDoctor {
    private db;
    private semantic;
    constructor(db?: RoutedDatabase, semantic?: SemanticEngine);
    runDiagnostics(): Promise<DoctorReport>;
    autoRepair(): Promise<{
        repaired: string[];
        failed: string[];
    }>;
}
//# sourceMappingURL=doctor.d.ts.map