import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    detectEnvironments,
    SkillScanner,
    RoutedDatabase,
} from '../packages/core/dist/index.js';
import { runScan } from '../packages/cli/dist/commands/scan.js';

test('Finding A: detectEnvironments includes ~/.agents/skills and ~/.agents/plugins', async () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'routed-test-home-'));
    const origHome = process.env.HOME;
    const origUserProfile = process.env.USERPROFILE;
    try {
        process.env.HOME = tmpHome;
        process.env.USERPROFILE = tmpHome;

        const agentsDir = path.join(tmpHome, '.agents');
        const agentsSkills = path.join(agentsDir, 'skills');
        const agentsPlugins = path.join(agentsDir, 'plugins');
        fs.mkdirSync(agentsSkills, { recursive: true });
        fs.mkdirSync(agentsPlugins, { recursive: true });

        // Also mock os.homedir by checking detector with mocked env
        const envs = detectEnvironments(tmpHome);
        const agentsEnv = envs.find((e) => e.id === 'agents');
        assert.ok(agentsEnv, 'Agents environment should be detected');
        assert.equal(agentsEnv.name, 'Agents User Library');
        assert.equal(agentsEnv.adapterSupported, false);
    } finally {
        process.env.HOME = origHome;
        process.env.USERPROFILE = origUserProfile;
        fs.rmSync(tmpHome, { recursive: true, force: true });
    }
});

test('Finding B: nested skills under container folders are discovered', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'routed-test-container-'));
    try {
        // Create container directory: gm/
        // gm has its own SKILL.md
        const gmDir = path.join(tmpDir, 'gm');
        fs.mkdirSync(gmDir, { recursive: true });
        fs.writeFileSync(
            path.join(gmDir, 'SKILL.md'),
            '---\nname: gm-parent\ndescription: Parent GM skill\n---\nParent skill body',
            'utf-8'
        );

        // gm has a nested subskill: gm/agent/
        const gmAgentDir = path.join(gmDir, 'agent');
        fs.mkdirSync(gmAgentDir, { recursive: true });
        fs.writeFileSync(
            path.join(gmAgentDir, 'SKILL.md'),
            '---\nname: gm-nested-agent\ndescription: Nested agent skill\n---\nNested agent body',
            'utf-8'
        );

        // Another container category without root SKILL.md: category/sub1 and category/sub2
        const sub1 = path.join(tmpDir, 'category', 'sub1');
        const sub2 = path.join(tmpDir, 'category', 'sub2');
        fs.mkdirSync(sub1, { recursive: true });
        fs.mkdirSync(sub2, { recursive: true });
        fs.writeFileSync(
            path.join(sub1, 'SKILL.md'),
            '---\nname: sub1\ndescription: Subskill 1\n---\nSub1 body',
            'utf-8'
        );
        fs.writeFileSync(
            path.join(sub2, 'SKILL.md'),
            '---\nname: sub2\ndescription: Subskill 2\n---\nSub2 body',
            'utf-8'
        );

        const scanner = new SkillScanner();
        const skills = scanner.scanEnvironments([
            {
                id: 'agents',
                name: 'Agents User Library',
                detected: true,
                skillPaths: [tmpDir],
                adapterSupported: false,
            },
        ]);

        const names = skills.map((s) => s.name);
        assert.ok(names.includes('gm-parent'), 'Should discover gm-parent');
        assert.ok(names.includes('gm-nested-agent'), 'Should discover gm-nested-agent under container');
        assert.ok(names.includes('sub1'), 'Should discover sub1');
        assert.ok(names.includes('sub2'), 'Should discover sub2');
        assert.equal(skills.length, 4, 'Should discover all 4 skills');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('Finding C: removeMissingSkills preserves existing skills from outside scanned roots', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'routed-test-prune-'));
    try {
        const rootA = path.join(tmpDir, 'rootA');
        const rootB = path.join(tmpDir, 'rootB');
        fs.mkdirSync(rootA, { recursive: true });
        fs.mkdirSync(rootB, { recursive: true });

        const skillAPath = path.join(rootA, 'SKILL.md');
        const skillBPath = path.join(rootB, 'SKILL.md');
        const deletedPath = path.join(tmpDir, 'non-existent', 'SKILL.md');

        fs.writeFileSync(skillAPath, '---\nname: skillA\n---\n', 'utf-8');
        fs.writeFileSync(skillBPath, '---\nname: skillB\n---\n', 'utf-8');

        const dbPath = path.join(tmpDir, 'test-routed.db');
        const db = new RoutedDatabase(dbPath);

        const mockSkillA = {
            id: 'custom:skilla:11111111',
            name: 'skillA',
            description: '',
            path: skillAPath,
            sourceHost: 'custom',
            aliases: [],
            keywords: [],
            tags: [],
            fileHash: 'hashA',
            modifiedAt: Date.now(),
            bodyPreview: '',
        };
        const mockSkillB = {
            id: 'custom:skillb:22222222',
            name: 'skillB',
            description: '',
            path: skillBPath,
            sourceHost: 'custom',
            aliases: [],
            keywords: [],
            tags: [],
            fileHash: 'hashB',
            modifiedAt: Date.now(),
            bodyPreview: '',
        };
        const mockDeleted = {
            id: 'custom:deleted:33333333',
            name: 'deletedSkill',
            description: '',
            path: deletedPath,
            sourceHost: 'custom',
            aliases: [],
            keywords: [],
            tags: [],
            fileHash: 'hashD',
            modifiedAt: Date.now(),
            bodyPreview: '',
        };

        db.upsertSkill(mockSkillA);
        db.upsertSkill(mockSkillB);
        db.upsertSkill(mockDeleted);

        assert.equal(db.getAllSkills().length, 3, 'Initial DB should have 3 skills');

        // Now simulate scanning ONLY rootA.
        // validPaths only contains skillAPath.
        // scannedRoots is [rootA].
        const validPaths = new Set([skillAPath]);
        const removed = db.removeMissingSkills(validPaths, [rootA]);

        // deletedPath does not exist on disk -> removed (1)
        // skillB exists on disk, but is NOT under rootA -> KEPT!
        // skillA is in validPaths -> KEPT!
        assert.equal(removed, 1, 'Only non-existent deleted skill should be pruned');

        const remaining = db.getAllSkills();
        const remainingPaths = remaining.map((s) => s.path);
        assert.ok(remainingPaths.includes(skillAPath), 'skillA must be preserved');
        assert.ok(remainingPaths.includes(skillBPath), 'skillB in unscanned root must be preserved');
        assert.ok(!remainingPaths.includes(deletedPath), 'deleted skill must be pruned');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('Finding B2: .codex/skills/.system/ and other allowed dot directories are scanned', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'routed-test-system-'));
    try {
        const systemSkillDir = path.join(tmpDir, '.system', 'core-tool');
        fs.mkdirSync(systemSkillDir, { recursive: true });
        fs.writeFileSync(
            path.join(systemSkillDir, 'SKILL.md'),
            '---\nname: system-core-tool\ndescription: System core tool skill\n---\nBody',
            'utf-8'
        );

        const scanner = new SkillScanner();
        const skills = scanner.scanEnvironments([
            {
                id: 'codex',
                name: 'Codex',
                detected: true,
                skillPaths: [tmpDir],
                adapterSupported: true,
            },
        ]);

        const names = skills.map((s) => s.name);
        assert.ok(names.includes('system-core-tool'), 'Should discover skills in .system directory');
        assert.equal(skills.length, 1);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('Finding B3: symlinked skill directories are discovered without infinite loops', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'routed-test-symlink-'));
    try {
        const realSkillDir = path.join(tmpDir, 'real-skills', 'my-skill');
        const symlinkContainer = path.join(tmpDir, 'active-skills');
        fs.mkdirSync(realSkillDir, { recursive: true });
        fs.mkdirSync(symlinkContainer, { recursive: true });
        fs.writeFileSync(
            path.join(realSkillDir, 'SKILL.md'),
            '---\nname: symlinked-skill\ndescription: Symlinked skill\n---\nBody',
            'utf-8'
        );

        // Create symlink
        const symlinkTarget = path.join(symlinkContainer, 'linked-skill');
        fs.symlinkSync(realSkillDir, symlinkTarget, 'dir');

        const scanner = new SkillScanner();
        const skills = scanner.scanEnvironments([
            {
                id: 'custom',
                name: 'Custom',
                detected: true,
                skillPaths: [symlinkContainer],
                adapterSupported: true,
            },
        ]);

        const names = skills.map((s) => s.name);
        assert.ok(names.includes('symlinked-skill'), 'Should discover symlinked skill directory');
        assert.equal(skills.length, 1);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

