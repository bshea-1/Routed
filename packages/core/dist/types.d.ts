export type HostId = 'antigravity' | 'claude-code' | 'cursor' | 'codex' | 'gemini' | 'opencode' | 'custom' | string;
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
//# sourceMappingURL=types.d.ts.map