import { LearningStore } from '@routed/core';
export interface FeedbackOptions {
    record?: string;
    skill?: string;
    clear?: boolean;
    list?: boolean;
    json?: boolean;
}
export function runFeedbackCommand(options: FeedbackOptions = {}): void {
    const store = new LearningStore();
    if (options.clear) {
        const count = store.clear();
        if (options.json) {
            console.log(JSON.stringify({ cleared: count }));
            return;
        }
        console.log(`\nCleared ${count} local routing preference(s).\n`);
        return;
    }
    if (options.record) {
        if (!options.skill) {
            console.error('Error: --skill is required when using --record');
            process.exit(1);
        }
        store.recordCorrection(options.record, options.skill);
        if (options.json) {
            console.log(JSON.stringify({ recorded: true, query: options.record, skill: options.skill }));
            return;
        }
        console.log(`\n[OK] Recorded local preference: "${options.record}" -> ${options.skill}\n`);
        return;
    }
    const all = store.getAll();
    if (options.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
    }
    console.log('\nLocal Routing Preferences (Spec Section 24)');
    console.log('───────────────────────────────────────────');
    if (all.length === 0) {
        console.log('No local routing corrections recorded yet.');
        console.log('Use `routed feedback --record "<prompt>" --skill "<skill-id>"` to record a correction.\n');
        return;
    }
    for (const c of all) {
        console.log(`  • Pattern: "${c.pattern}" -> Preferred: ${c.preferredSkillId} (Weight: ${c.count}x)`);
    }
    console.log('\nRun `routed feedback --clear` to erase all preference data.\n');
}
