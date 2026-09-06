export function dotProduct(a: number[] | Float32Array, b: number[] | Float32Array): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
    }
    return dot;
}
export function magnitude(v: number[] | Float32Array): number {
    let sumSq = 0;
    for (let i = 0; i < v.length; i++) {
        sumSq += v[i] * v[i];
    }
    return Math.sqrt(sumSq);
}
export function normalizeVector(v: number[] | Float32Array): number[] {
    const mag = magnitude(v);
    if (mag === 0)
        return Array.from(v);
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) {
        out[i] = v[i] / mag;
    }
    return out;
}
export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array, isPreNormalized = false): number {
    if (a.length === 0 || b.length === 0)
        return 0;
    if (isPreNormalized) {
        const dot = dotProduct(a, b);
        return Math.max(0, Math.min(1.0, (dot + 1) / 2));
    }
    const magA = magnitude(a);
    const magB = magnitude(b);
    if (magA === 0 || magB === 0)
        return 0;
    const rawCos = dotProduct(a, b) / (magA * magB);
    return Math.max(0, Math.min(1.0, (rawCos + 1) / 2));
}
export function meanPooling(embeddings: number[][], attentionMask?: number[]): number[] {
    if (embeddings.length === 0)
        return [];
    const dim = embeddings[0].length;
    const pooled = new Array(dim).fill(0);
    let count = 0;
    for (let i = 0; i < embeddings.length; i++) {
        if (attentionMask && attentionMask[i] === 0)
            continue;
        const tokenVec = embeddings[i];
        for (let d = 0; d < dim; d++) {
            pooled[d] += tokenVec[d];
        }
        count++;
    }
    if (count === 0)
        return pooled;
    for (let d = 0; d < dim; d++) {
        pooled[d] /= count;
    }
    return normalizeVector(pooled);
}
