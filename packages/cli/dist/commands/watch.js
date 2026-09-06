import { RoutedDatabase, SemanticEngine, detectEnvironments, SkillWatcher } from '../../../core/dist/index.js';
export function runWatch(options = {}) {
    const db = new RoutedDatabase();
    const semantic = new SemanticEngine();
    const environments = detectEnvironments();
    const watcher = new SkillWatcher(db, semantic);
    const watched = watcher.watchEnvironments(environments);
    if (!options.quiet) {
        console.log('\nRouted Incremental Watcher (Spec Section 18)');
        console.log('───────────────────────────────────────────');
        console.log(`Watching ${watched.length} skill directories across detected environments:`);
        for (const p of watched) {
            console.log(`  • ${p}`);
        }
        console.log('\nListening for skill additions, edits, and deletions... (Press Ctrl+C to stop)\n');
    }
    watcher.onChange((event) => {
        const time = new Date().toLocaleTimeString();
        const action = event.type.toUpperCase().padEnd(7);
        const name = event.skill ? event.skill.name : event.filePath;
        console.log(`[${time}] ${action} ${name} (${event.filePath})`);
    });
    process.on('SIGINT', () => {
        if (!options.quiet) {
            console.log('\nStopping watcher...');
        }
        watcher.stop();
        process.exit(0);
    });
}
//# sourceMappingURL=watch.js.map