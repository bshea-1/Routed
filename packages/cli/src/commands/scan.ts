import { detectEnvironments, SkillScanner, RoutedDatabase, ensureDataDirectories, ScanResult } from '../../../core/dist/index.js';
export interface ScanOptions {
    workspace?: string;
    json?: boolean;
    quiet?: boolean;
}
export function runScan(options: ScanOptions = {}): ScanResult {
    const startTime = performance.now();
    ensureDataDirectories();
    const db = new RoutedDatabase();
    const environments = detectEnvironments(options.workspace);
    const scanner = new SkillScanner();
    const discoveredSkills = scanner.scanEnvironments(environments);
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const validPaths = new Set<string>();
    for (const skill of discoveredSkills) {
        validPaths.add(skill.path);
        const existing = db.getSkillByPath(skill.path);
        if (!existing) {
            newCount++;
            db.upsertSkill(skill);
        }
        else if (existing.fileHash !== skill.fileHash) {
            updatedCount++;
            db.upsertSkill(skill);
        }
        else {
            unchangedCount++;
        }
    }
    const removedCount = db.removeMissingSkills(validPaths);
    db.saveEnvironments(environments);
    db.setMeta('last_scan_time', new Date().toISOString());
    const scanDurationMs = Math.round(performance.now() - startTime);
    const result: ScanResult = {
        environments,
        skills: discoveredSkills,
        newCount,
        updatedCount,
        unchangedCount,
        removedCount,
        scanDurationMs,
    };
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return result;
    }
    if (!options.quiet) {
        console.log('\nScanning AI coding environments...');
        for (const env of environments) {
            const mark = env.detected ? '[OK]' : '[-]';
            console.log(`  ${mark} ${env.name.padEnd(20)} ${env.detected ? `(${env.skillPaths.length} skill path${env.skillPaths.length === 1 ? '' : 's'})` : 'not detected'}`);
        }
        console.log(`\nDiscovered ${discoveredSkills.length} total skill(s) across detected environments:`);
        console.log(`  • New skills:       ${newCount}`);
        console.log(`  • Updated skills:   ${updatedCount}`);
        console.log(`  • Unchanged skills: ${unchangedCount}`);
        if (removedCount > 0) {
            console.log(`  • Pruned missing:   ${removedCount}`);
        }
        console.log(`\nIndex updated in ${scanDurationMs}ms.\n`);
    }
    return result;
}
