import readline from 'node:readline';
import { detectEnvironments, SkillScanner, RoutedDatabase, SemanticEngine, getPaths, } from '@routed/core';
import { AdapterRegistry } from '@routed/adapters';
import fs from 'node:fs';
function promptUser(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans.trim());
        });
    });
}
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function runSetupCommand(options: {
    yes?: boolean;
    quiet?: boolean;
} = {}): Promise<void> {
    const isAutomated = options.yes || false;
    console.log(`
======================================================
  Routed: Universal Skill Router for AI Coding Tools
======================================================

One /route command for your AI coding tools.
Local semantic intelligence. Zero cloud routing tokens.
Works with Antigravity, OpenCode, Claude Code, Cursor, and Codex.
`);
    if (!isAutomated) {
        await promptUser('Press [Enter] to begin installation (or Ctrl+C to cancel)... ');
    }
    console.log(`
Scanning system for AI coding environments...
─────────────────────────────────────────────`);
    const environments = detectEnvironments();
    for (const env of environments) {
        if (env.detected) {
            console.log(`  [OK] ${env.name.padEnd(16)} (Detected at ${env.skillPaths[0] || 'default'})`);
        }
        else {
            console.log(`  [-] ${env.name.padEnd(16)} (Not installed)`);
        }
    }
    console.log(`\nScanning for installed Agent Skills...`);
    const scanner = new SkillScanner();
    const discoveredSkills = scanner.scanEnvironments(environments);
    console.log(`  [OK] ${discoveredSkills.length} compatible skills found.`);
    if (!isAutomated) {
        await delay(600);
        await promptUser('\nPress [Enter] to proceed with setup... ');
    }
    console.log(`
Installing Routed...
───────────────────`);
    const paths = getPaths();
    fs.mkdirSync(paths.rootDir, { recursive: true });
    fs.mkdirSync(paths.modelDir, { recursive: true });
    fs.mkdirSync(paths.logsDir, { recursive: true });
    console.log(`  [OK] Local router initialized at ${paths.rootDir}`);
    await delay(100);
    const db = new RoutedDatabase();
    const semantic = new SemanticEngine();
    console.log(`  [OK] Semantic model verified (${semantic.getModelName()})`);
    await delay(100);
    console.log(`  Building local skill index...`);
    db.saveEnvironments(environments);
    for (const skill of discoveredSkills) {
        db.upsertSkill(skill);
    }
    await semantic.indexSkills(discoveredSkills, db);
    console.log(`  [OK] Skill index built: ${discoveredSkills.length} / ${discoveredSkills.length} skills indexed`);
    await delay(100);
    console.log(`  Installing /route adapters into detected environments...`);
    const registry = new AdapterRegistry();
    const results = await registry.installDetected();
    for (const res of results) {
        if (res.success) {
            console.log(`  [OK] ${res.name.padEnd(16)} /route adapter installed`);
        }
        else {
            console.log(`  ! ${res.name.padEnd(16)} ${res.message}`);
        }
    }
    db.close();
    console.log(`
======================================================
  Routed is ready.
======================================================

Open your AI coding agent and type:

  /route <your prompt>

Example:
  /route debug high memory consumption in nodejs
  /route inspect fda drug adverse event warnings
  /route create a fast api endpoint with validation

Enjoy fast, local, zero-token skill routing!
`);
}
