import { RouteOptions, RouteResult, SkillMetadata } from '../types.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
import { HybridScorer } from '../scorer/hybrid-scorer.js';
import { RoutedDatabase } from '../storage/database.js';
import { LearningStore } from '../learning/learning-store.js';
export declare class HybridRouter {
    private bm25;
    private semantic;
    private scorer;
    private db;
    private learningStore?;
    private skills;
    constructor(skills?: SkillMetadata[], db?: RoutedDatabase, semantic?: SemanticEngine, learningStore?: LearningStore, scorer?: HybridScorer);
    getScorer(): HybridScorer;
    getDatabase(): RoutedDatabase;
    updateSkills(skills: SkillMetadata[]): void;
    route(query: string, options?: RouteOptions): Promise<RouteResult>;
}
//# sourceMappingURL=hybrid-router.d.ts.map