import { BenchmarkCase, SkillMetadata, TunableParameters } from '../types.js';
import { BM25Engine } from '../lexical/bm25.js';
import { SemanticEngine } from '../semantic/semantic-engine.js';
import { RoutedDatabase } from '../storage/database.js';
export interface CandidateSignal {
    skillName: string;
    exactScore: number;
    bm25Score: number;
    semanticScore: number;
    metaScore: number;
}
export interface PrecomputedCaseSignal {
    caseId: string;
    prompt: string;
    isTrivialNoSkill: boolean;
    hasExactMatch: boolean;
    exactTopSkills: string[];
    candidates: CandidateSignal[];
}
export declare class PrecomputedSignalsEngine {
    private caseSignals;
    precomputeAll(cases: BenchmarkCase[], skills: SkillMetadata[], db: RoutedDatabase, semanticEngine: SemanticEngine, bm25Engine: BM25Engine, onProgress?: (completed: number, total: number) => void): Promise<void>;
    precomputeQuery(prompt: string, skills: SkillMetadata[], db: RoutedDatabase, semanticEngine: SemanticEngine, bm25Engine: BM25Engine): Promise<PrecomputedCaseSignal>;
    evaluateWithParams(cases: BenchmarkCase[], params: TunableParameters, topK?: number): Array<{
        actual: string[];
        isNoSkill: boolean;
    }>;
    getSignal(caseId: string): PrecomputedCaseSignal | undefined;
}
//# sourceMappingURL=precomputed-signals.d.ts.map