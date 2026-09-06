import { RoutedDatabase } from '@routed/core';
export interface SkillsOptions {
    json?: boolean;
    filter?: string;
    host?: string;
}
export function runSkills(options: SkillsOptions = {}): void {
    const db = new RoutedDatabase();
    let skills = db.getAllSkills();
    if (options.host) {
        skills = skills.filter((s) => s.sourceHost === options.host);
    }
    if (options.filter) {
        const f = options.filter.toLowerCase();
        skills = skills.filter((s) => s.name.toLowerCase().includes(f) ||
            s.description.toLowerCase().includes(f) ||
            s.aliases.some((a) => a.toLowerCase().includes(f)));
    }
    if (options.json) {
        console.log(JSON.stringify(skills, null, 2));
        return;
    }
    if (skills.length === 0) {
        console.log('\nNo skills found in the local index.');
        console.log('Run `routed scan` to discover installed Agent Skills.\n');
        return;
    }
    console.log(`\nIndexed Skills (${skills.length}):\n`);
    console.log(`${'Name'.padEnd(32)} ${'Host'.padEnd(16)} Description`);
    console.log(`${'-'.repeat(31)} ${'-'.repeat(15)} ${'-'.repeat(40)}`);
    for (const s of skills) {
        const desc = s.description.length > 55 ? s.description.slice(0, 52) + '...' : s.description;
        console.log(`${s.name.padEnd(32)} ${s.sourceHost.padEnd(16)} ${desc || '(no description)'}`);
    }
    console.log('');
}
