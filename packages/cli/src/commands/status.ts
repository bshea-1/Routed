import { RoutedDatabase, detectEnvironments, getPaths, SemanticEngine } from '../../../core/dist/index.js';
export interface StatusOptions {
    json?: boolean;
}
export function runStatus(options: StatusOptions = {}): void {
    const paths = getPaths();
    const db = new RoutedDatabase();
    const skills = db.getAllSkills();
    const embeddings = db.getAllEmbeddings();
    const environments = detectEnvironments();
    const lastScan = db.getMeta('last_scan_time');
    const semanticEngine = new SemanticEngine();
    const customWeights = db.getRoutingWeights();
    const tuneReport = db.getLatestTuneReport();
    let engineDesc = 'Hybrid Pipeline (Semantic 50% + BM25 35% + Exact 10% + Adaptive History 5-25%) [Factory Baseline]';
    if (customWeights) {
        const s = Math.round(customWeights.semanticWeight * 100);
        const b = Math.round(customWeights.lexicalWeight * 100);
        const e = Math.round(customWeights.exactWeight * 100);
        const m = Math.round(customWeights.metadataWeight * 100);
        const oofText = tuneReport ? ` | ${tuneReport.crossValidation.meanValAccuracy.toFixed(1)}% OOF CV` : '';
        engineDesc = `Hybrid Pipeline (Semantic ${s}% + BM25 ${b}% + Exact ${e}% + Meta ${m}%)${oofText} [Tuned via Grid Search]`;
    }

    const statusData = {
        router: 'Ready',
        semanticModel: semanticEngine.getModelName(),
        engine: engineDesc,
        scoringWeights: customWeights || {
            semanticWeight: 0.50,
            lexicalWeight: 0.35,
            exactWeight: 0.10,
            metadataWeight: 0.05,
        },
        tuningSource: customWeights ? 'grid-search-cross-validation' : 'factory-baseline',
        skillsIndexed: skills.length,
        embeddingsComputed: embeddings.length,
        databasePath: paths.databasePath,
        dataDirectory: paths.rootDir,
        lastScanTime: lastScan || 'Never',
        environments: environments.map((e) => ({
            name: e.name,
            id: e.id,
            detected: e.detected,
            skillPaths: e.skillPaths,
        })),
    };
    if (options.json) {
        console.log(JSON.stringify(statusData, null, 2));
        return;
    }
    console.log('\nRouted Status');
    console.log('─────────────');
    console.log(`Router:              ${statusData.router}`);
    console.log(`Semantic Model:      ${statusData.semanticModel}`);
    console.log(`Routing Engine:      ${statusData.engine}`);
    console.log(`Skills Indexed:      ${statusData.skillsIndexed}`);
    console.log(`Embeddings Cached:   ${statusData.embeddingsComputed}`);
    console.log(`Database:            ${statusData.databasePath}`);
    console.log(`Last Scan:           ${statusData.lastScanTime}`);
    console.log('\nEnvironments:');
    for (const env of statusData.environments) {
        const mark = env.detected ? '[OK]' : '[-]';
        const statusText = env.detected
            ? `${env.skillPaths.length} skill path(s)`
            : 'not detected';
        console.log(`  ${mark} ${env.name.padEnd(20)} ${statusText}`);
    }
    console.log('');
}
