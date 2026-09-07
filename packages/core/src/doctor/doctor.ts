import fs from 'node:fs';
import path from 'node:path';
import { getPaths } from '../config/paths.js';
import { RoutedDatabase } from '../storage/database.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
import { detectEnvironments } from '../discovery/detector.js';
export interface DoctorCheck {
    id: string;
    category: 'system' | 'database' | 'model' | 'adapters' | 'environments' | 'routing';
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
export class RoutedDoctor {
    private db: RoutedDatabase;
    private semantic: SemanticEngine;
    constructor(db?: RoutedDatabase, semantic?: SemanticEngine) {
        this.db = db || new RoutedDatabase();
        this.semantic = semantic || new SemanticEngine();
    }
    public async runDiagnostics(): Promise<DoctorReport> {
        const checks: DoctorCheck[] = [];
        const paths = getPaths();
        try {
            if (fs.existsSync(paths.rootDir)) {
                fs.accessSync(paths.rootDir, fs.constants.R_OK | fs.constants.W_OK);
                checks.push({
                    id: 'data-dir',
                    category: 'system',
                    name: 'Application Data Directory',
                    status: 'ok',
                    message: `Writable directory verified at ${paths.rootDir}`,
                });
            }
            else {
                checks.push({
                    id: 'data-dir',
                    category: 'system',
                    name: 'Application Data Directory',
                    status: 'warn',
                    message: `Data directory does not exist yet: ${paths.rootDir}`,
                    fixable: true,
                });
            }
        }
        catch (err) {
            checks.push({
                id: 'data-dir',
                category: 'system',
                name: 'Application Data Directory',
                status: 'error',
                message: `Permission denied on ${paths.rootDir}: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
        try {
            const skills = this.db.getAllSkills();
            const schemaVer = this.db.getMeta('schema_version');
            checks.push({
                id: 'database-integrity',
                category: 'database',
                name: 'SQLite Index Database',
                status: 'ok',
                message: `Database accessible (Schema v${schemaVer || '1'}), ${skills.length} skills indexed.`,
            });
        }
        catch (err) {
            checks.push({
                id: 'database-integrity',
                category: 'database',
                name: 'SQLite Index Database',
                status: 'error',
                message: `Database corruption or access error: ${err instanceof Error ? err.message : String(err)}`,
                fixable: true,
            });
        }
        try {
            const modelName = this.semantic.getModelName();
            const embeddings = this.db.getAllEmbeddings();
            checks.push({
                id: 'semantic-model',
                category: 'model',
                name: 'Semantic Embedding Model',
                status: 'ok',
                message: `Model: ${modelName} (${embeddings.length} embeddings cached).`,
            });
        }
        catch (err) {
            checks.push({
                id: 'semantic-model',
                category: 'model',
                name: 'Semantic Embedding Model',
                status: 'warn',
                message: `Semantic model check warning: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
        const envs = detectEnvironments();
        const detectedCount = envs.filter((e) => e.detected).length;
        if (detectedCount > 0) {
            checks.push({
                id: 'environments',
                category: 'environments',
                name: 'AI Coding Environments',
                status: 'ok',
                message: `Discovered ${detectedCount} active environment(s): ${envs.filter((e) => e.detected).map((e) => e.name).join(', ')}`,
            });
        }
        else {
            checks.push({
                id: 'environments',
                category: 'environments',
                name: 'AI Coding Environments',
                status: 'warn',
                message: 'No supported AI coding environments detected in standard locations.',
            });
        }

        const customWeights = this.db.getRoutingWeights();
        if (customWeights) {
            const sum = customWeights.semanticWeight + customWeights.lexicalWeight + customWeights.exactWeight + customWeights.metadataWeight;
            const isValid = Math.abs(sum - 1.0) < 0.02 &&
                customWeights.semanticWeight >= 0 &&
                customWeights.lexicalWeight >= 0 &&
                customWeights.exactWeight >= 0 &&
                customWeights.metadataWeight >= 0;
            if (isValid) {
                checks.push({
                    id: 'routing-weights',
                    category: 'routing',
                    name: 'Routing Scoring Weights',
                    status: 'ok',
                    message: `Empirically tuned weights active (Sem: ${Math.round(customWeights.semanticWeight * 100)}%, BM25: ${Math.round(customWeights.lexicalWeight * 100)}%, Exact: ${Math.round(customWeights.exactWeight * 100)}%, Meta: ${Math.round(customWeights.metadataWeight * 100)}%).`,
                });
            } else {
                checks.push({
                    id: 'routing-weights',
                    category: 'routing',
                    name: 'Routing Scoring Weights',
                    status: 'warn',
                    message: `Tuned weights sum to ${(sum * 100).toFixed(1)}% (expected ~100%). Resetting to baseline recommended.`,
                    fixable: true,
                });
            }
        } else {
            checks.push({
                id: 'routing-weights',
                category: 'routing',
                name: 'Routing Scoring Weights',
                status: 'ok',
                message: 'Standard empirical baseline active (Sem: 50%, BM25: 35%, Exact: 10%, Meta: 5%).',
            });
        }

        const allOk = checks.every((c) => c.status !== 'error');
        return {
            timestamp: new Date().toISOString(),
            allOk,
            checks,
        };
    }
    public async autoRepair(): Promise<{
        repaired: string[];
        failed: string[];
    }> {
        const report = await this.runDiagnostics();
        const repaired: string[] = [];
        const failed: string[] = [];
        const paths = getPaths();
        for (const check of report.checks) {
            if (check.status !== 'ok' && check.fixable) {
                try {
                    if (check.id === 'data-dir') {
                        fs.mkdirSync(paths.rootDir, { recursive: true });
                        repaired.push(`Created data directory at ${paths.rootDir}`);
                    }
                    else if (check.id === 'database-integrity') {
                        this.db.setMeta('schema_version', '2');
                        repaired.push('Re-initialized database schema');
                    }
                    else if (check.id === 'routing-weights') {
                        this.db.clearRoutingWeights();
                        repaired.push('Reset routing weights to standard empirical baseline');
                    }
                }
                catch (err) {
                    failed.push(`${check.id}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }
        return { repaired, failed };
    }
}
