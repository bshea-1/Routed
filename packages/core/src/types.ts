export type HostId = 'antigravity' | 'claude-code' | 'cursor' | 'codex' | 'gemini' | 'opencode' | 'hermes' | 'mcp' | 'lmstudio' | 'ollama' | 'windsurf' | 'continue' | 'custom' | string;
export interface HostEnvironment {
    id: HostId;
    name: string;
    detected: boolean;
    basePath?: string;
    skillPaths: string[];
    adapterSupported: boolean;
    configSource?: 'builtin' | 'user-config' | 'workspace';
}
export interface SkillMetadata {
    id: string;
    name: string;
    description: string;
    path: string;
    sourceHost: HostId;
    aliases: string[];
    keywords: string[];
    tags: string[];
    fileHash: string;
    modifiedAt: number;
    bodyPreview: string;
    rawFrontmatter?: Record<string, unknown>;
}
export interface RouteSignals {
    exactMatch: number;
    aliasMatch: number;
    bm25Score: number;
    rawBm25Score: number;
    semanticScore: number;
    metadataScore: number;
    matchedTokens: string[];
    historyBonus?: number;
    decayedCount?: number;
}
export interface SkillEmbedding {
    skillId: string;
    vector: number[];
    fileHash: string;
    modelName: string;
    embeddedAt: number;
}
export interface ScoredSkill {
    skill: SkillMetadata;
    score: number;
    confidence: number;
    signals: RouteSignals;
}
export interface RouteOptions {
    topK?: number;
    threshold?: number;
    multiSkillThreshold?: number;
    allowNoSkill?: boolean;
    explain?: boolean;
    semanticWeight?: number;
    lexicalWeight?: number;
    exactWeight?: number;
    metadataWeight?: number;
    skipSemanticIfExact?: boolean;
}
export interface RouteResult {
    query: string;
    selectedSkills: ScoredSkill[];
    confidence: number;
    isNoSkill: boolean;
    consideredCount: number;
    executionTimeMs: number;
    explanation?: {
        summary: string;
        candidates: ScoredSkill[];
        noSkillReason?: string;
    };
}
export interface ScanResult {
    environments: HostEnvironment[];
    skills: SkillMetadata[];
    newCount: number;
    updatedCount: number;
    unchangedCount: number;
    removedCount: number;
    scanDurationMs: number;
}

export interface HybridScorerWeights {
    semanticWeight: number;
    lexicalWeight: number;
    exactWeight: number;
    metadataWeight: number;
}

export interface TunableParameters extends HybridScorerWeights {
    threshold?: number;
    multiSkillThreshold?: number;
}

export type BenchmarkCategory =
    | 'exact-match'
    | 'synonym'
    | 'technical-jargon'
    | 'abbreviation'
    | 'indirect-intent'
    | 'multilingual'
    | 'multi-skill'
    | 'no-skill'
    | 'domain-specific'
    | 'irrelevant-trap'
    | string;

export interface BenchmarkCase {
    id: string;
    category: BenchmarkCategory;
    prompt: string;
    expectedSkills: string[];
    description: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    weight?: number;
}

export interface EvaluationMetrics {
    totalCases: number;
    top1Accuracy: number;
    top3Recall: number;
    top5Recall: number;
    mrr: number;
    noSkillAccuracy: number;
    noSkillCases: number;
    noSkillMatches: number;
    compositeScore: number;
    meanLatencyMs: number;
    medianLatencyMs: number;
    passedCount: number;
    failedCount: number;
    categoryBreakdown?: Record<string, { total: number; passed: number; accuracy: number }>;
}

export interface BenchmarkMetrics extends EvaluationMetrics {
    results: Array<{
        id: string;
        prompt: string;
        category: string;
        expected: string[];
        actual: string[];
        isTop1Match: boolean;
        isTop3Match: boolean;
        latencyMs: number;
    }>;
}

export interface ParameterCandidate {
    params: TunableParameters;
    metrics: EvaluationMetrics;
    score: number;
}

export interface GridSearchOptions {
    gridStep?: number;
    coarseToFine?: boolean;
    metric?: 'composite' | 'top1' | 'top3' | 'mrr' | 'f1';
    thresholds?: number[];
    minSemanticWeight?: number;
    maxSemanticWeight?: number;
    minLexicalWeight?: number;
    maxLexicalWeight?: number;
    minExactWeight?: number;
    maxExactWeight?: number;
    minMetadataWeight?: number;
    maxMetadataWeight?: number;
    topNCandidates?: number;
}

export interface GridSearchResult {
    bestCandidate: ParameterCandidate;
    baselineCandidate: ParameterCandidate;
    topCandidates: ParameterCandidate[];
    totalConfigurationsTested: number;
    searchDurationMs: number;
    metricUsed: string;
}

export interface FoldResult {
    foldIndex: number;
    trainCasesCount: number;
    valCasesCount: number;
    bestTrainParams: TunableParameters;
    trainMetrics: EvaluationMetrics;
    valMetrics: EvaluationMetrics;
    baselineValMetrics: EvaluationMetrics;
    generalizationGap: number;
}

export interface CrossValidationReport {
    kFolds: number;
    totalCases: number;
    folds: FoldResult[];
    meanTrainAccuracy: number;
    meanValAccuracy: number;
    meanGeneralizationGap: number;
    valAccuracyStdDev: number;
    oofMetrics: EvaluationMetrics;
    recommendedParams: TunableParameters;
    recommendedMetrics: EvaluationMetrics;
    baselineOofMetrics: EvaluationMetrics;
    durationMs: number;
    timestamp: string;
}

export interface TuneReport {
    timestamp: string;
    kFolds: number;
    totalCases: number;
    testedCombinations: number;
    optimalWeights: HybridScorerWeights;
    optimalThreshold: number;
    crossValidation: CrossValidationReport;
    appliedToDatabase: boolean;
}
