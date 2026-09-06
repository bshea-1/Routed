import { getPaths } from '../config/paths.js';
import { cosineSimilarity, normalizeVector } from './vector-math.js';
export class SemanticEngine {
    modelName;
    cacheDir;
    keepWarmMs;
    pipelineInstance = null;
    warmTimeout = null;
    isTransformersLoaded = false;
    initPromise = null;
    constructor(options = {}) {
        const paths = getPaths();
        this.modelName = options.modelName || process.env.ROUTED_SEMANTIC_MODEL || 'Xenova/multilingual-e5-small';
        this.cacheDir = options.cacheDir || paths.modelDir;
        this.keepWarmMs = options.keepWarmMs ?? 5 * 60 * 1000;
    }
    getModelName() {
        return this.modelName;
    }
    async init() {
        if (this.pipelineInstance) {
            this.resetWarmTimer();
            return true;
        }
        if (this.initPromise) {
            return this.initPromise;
        }
        if (process.env.ROUTED_OFFLINE === 'true' || process.env.NODE_ENV === 'test') {
            this.isTransformersLoaded = false;
            this.initPromise = Promise.resolve(false);
            return this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                const transformers = await import('@huggingface/transformers').catch(() => null);
                if (transformers && transformers.pipeline) {
                    if (transformers.env) {
                        transformers.env.cacheDir = this.cacheDir;
                        transformers.env.allowRemoteModels = true;
                    }
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Model load timed out')), 4000));
                    this.pipelineInstance = await Promise.race([
                        transformers.pipeline('feature-extraction', this.modelName, { dtype: 'q8' }),
                        timeoutPromise,
                    ]);
                    this.isTransformersLoaded = true;
                    this.resetWarmTimer();
                    return true;
                }
            }
            catch {
            }
            this.isTransformersLoaded = false;
            return false;
        })();
        return this.initPromise;
    }
    async embed(text, isQuery = false) {
        const isReady = await this.init();
        if (isReady && this.pipelineInstance) {
            this.resetWarmTimer();
            try {
                let formatted = text;
                if (isQuery) {
                    if (this.modelName.includes('e5')) {
                        formatted = `query: ${text}`;
                    }
                    else if (this.modelName.includes('arctic-embed')) {
                        formatted = `Represent this sentence for searching relevant passages: ${text}`;
                    }
                }
                else if (this.modelName.includes('e5')) {
                    formatted = `passage: ${text}`;
                }
                const output = await this.pipelineInstance(formatted, { pooling: 'mean', normalize: true });
                const rawData = Array.from(output.data);
                return normalizeVector(rawData);
            }
            catch {
            }
        }
        return this.fallbackDenseVector(text);
    }
    async indexSkills(skills, db) {
        let embeddedCount = 0;
        let reusedCount = 0;
        for (const skill of skills) {
            const existing = db.getEmbedding(skill.id);
            if (existing && existing.fileHash === skill.fileHash && existing.modelName === this.modelName) {
                reusedCount++;
                continue;
            }
            const text = this.prepareSkillText(skill);
            const vector = await this.embed(text, false);
            const skillEmbedding = {
                skillId: skill.id,
                vector,
                fileHash: skill.fileHash,
                modelName: this.modelName,
                embeddedAt: Date.now(),
            };
            db.upsertEmbedding(skillEmbedding);
            embeddedCount++;
        }
        return { embeddedCount, reusedCount };
    }
    async search(query, skills, db) {
        const queryVector = await this.embed(query, true);
        const results = [];
        const allEmbeddings = db.getAllEmbeddings();
        const embMap = new Map();
        for (const e of allEmbeddings) {
            embMap.set(e.skillId, e);
        }
        for (const skill of skills) {
            let emb = embMap.get(skill.id);
            if (!emb) {
                const text = this.prepareSkillText(skill);
                const vector = await this.embed(text, false);
                emb = {
                    skillId: skill.id,
                    vector,
                    fileHash: skill.fileHash,
                    modelName: this.modelName,
                    embeddedAt: Date.now(),
                };
                db.upsertEmbedding(emb);
                embMap.set(skill.id, emb);
            }
            const sim = cosineSimilarity(queryVector, emb.vector, true);
            results.push({ skill, similarity: sim });
        }
        return results.sort((a, b) => b.similarity - a.similarity);
    }
    prepareSkillText(skill) {
        const parts = [
            `Skill: ${skill.name}`,
            skill.description ? `Description: ${skill.description}` : '',
            skill.aliases.length > 0 ? `Aliases: ${skill.aliases.join(', ')}` : '',
            skill.keywords.length > 0 ? `Keywords: ${skill.keywords.join(', ')}` : '',
            skill.tags.length > 0 ? `Tags: ${skill.tags.join(', ')}` : '',
            skill.bodyPreview ? `Details: ${skill.bodyPreview.slice(0, 300)}` : '',
        ];
        return parts.filter(Boolean).join('. ');
    }
    resetWarmTimer() {
        if (this.warmTimeout) {
            clearTimeout(this.warmTimeout);
        }
        this.warmTimeout = setTimeout(() => {
            this.unload();
        }, this.keepWarmMs);
        if (this.warmTimeout && typeof this.warmTimeout.unref === 'function') {
            this.warmTimeout.unref();
        }
    }
    unload() {
        if (this.pipelineInstance) {
            this.pipelineInstance = null;
            this.initPromise = null;
        }
        if (this.warmTimeout) {
            clearTimeout(this.warmTimeout);
            this.warmTimeout = null;
        }
    }
    fallbackDenseVector(text) {
        const dim = 384;
        const vector = new Array(dim).fill(0);
        const cleaned = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
        const tokens = cleaned.split(/\s+/).filter(Boolean);
        if (tokens.length === 0)
            return vector;
        for (const token of tokens) {
            let h1 = 0x811c9dc5;
            for (let i = 0; i < token.length; i++) {
                h1 ^= token.charCodeAt(i);
                h1 = Math.imul(h1, 0x01000193);
            }
            const idx1 = Math.abs(h1) % dim;
            const sign1 = (h1 & 0x1) ? 1.0 : -1.0;
            vector[idx1] += sign1 * 1.5;
            for (let i = 0; i <= token.length - 3; i++) {
                const tri = token.slice(i, i + 3);
                let h2 = 0x811c9dc5;
                for (let j = 0; j < tri.length; j++) {
                    h2 ^= tri.charCodeAt(j);
                    h2 = Math.imul(h2, 0x01000193);
                }
                const idx2 = Math.abs(h2) % dim;
                const sign2 = (h2 & 0x1) ? 0.6 : -0.6;
                vector[idx2] += sign2;
            }
        }
        return normalizeVector(vector);
    }
}
//# sourceMappingURL=semantic-engine.js.map