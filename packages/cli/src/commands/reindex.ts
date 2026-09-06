import { RoutedDatabase, SemanticEngine, detectEnvironments, SkillScanner } from '@routed/core';
export interface ReindexOptions {
    force?: boolean;
    json?: boolean;
}
export async function runReindex(options: ReindexOptions = {}): Promise<void> {
    const startTime = performance.now();
    const db = new RoutedDatabase();
    const semantic = new SemanticEngine();
    const environments = detectEnvironments();
    const scanner = new SkillScanner();
    if (!options.json) {
        console.log('\nScanning and re-indexing Agent Skills...');
    }
    const skills = scanner.scanEnvironments(environments);
    if (options.force) {
        db.removeMissingEmbeddings(new Set());
        if (!options.json) {
            console.log('  • Cleared existing embedding cache (--force)');
        }
    }
    const validPaths = new Set<string>();
    let updatedCount = 0;
    for (const skill of skills) {
        validPaths.add(skill.path);
        db.upsertSkill(skill);
        updatedCount++;
    }
    const removedCount = db.removeMissingSkills(validPaths);
    const embedRes = await semantic.indexSkills(skills, db);
    const durationMs = Math.round(performance.now() - startTime);
    const stats = {
        skillsFound: skills.length,
        skillsUpdated: updatedCount,
        skillsRemoved: removedCount,
        embeddingsComputed: embedRes.embeddedCount,
        embeddingsReused: embedRes.reusedCount,
        durationMs,
    };
    if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
    }
    console.log(`\nReindexing complete in ${durationMs}ms:`);
    console.log(`  • Skills indexed:        ${stats.skillsFound}`);
    console.log(`  • Embeddings recomputed: ${stats.embeddingsComputed}`);
    console.log(`  • Embeddings reused:     ${stats.embeddingsReused}`);
    if (removedCount > 0) {
        console.log(`  • Stale skills pruned:   ${removedCount}`);
    }
    console.log('');
}
