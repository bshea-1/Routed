import readline from 'node:readline';
import fs from 'node:fs';
import { HybridRouter } from '../router/hybrid-router.js';
import { RoutedDatabase } from '../storage/database.js';
import { SkillScanner } from '../discovery/scanner.js';
import { detectEnvironments } from '../discovery/detector.js';
import { LearningStore } from '../learning/learning-store.js';
export class McpServer {
    router;
    db;
    scanner;
    learningStore;
    version;
    constructor(options = {}) {
        this.db = options.db || new RoutedDatabase();
        this.learningStore = options.learningStore || new LearningStore();
        const initialSkills = this.db.getAllSkills();
        this.router = options.router || new HybridRouter(initialSkills, this.db, undefined, this.learningStore);
        this.scanner = options.scanner || new SkillScanner();
        this.version = options.version || '1.0.1';
    }
    startStdio() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        rl.on('line', async (line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                return;
            }
            try {
                const request = JSON.parse(trimmed);
                const response = await this.handleMessage(request);
                if (response) {
                    process.stdout.write(`${JSON.stringify(response)}\n`);
                }
            }
            catch (err) {
                const errResponse = {
                    jsonrpc: '2.0',
                    id: null,
                    error: {
                        code: -32700,
                        message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
                    },
                };
                process.stdout.write(`${JSON.stringify(errResponse)}\n`);
            }
        });
    }
    async handleMessage(request) {
        const { id, method, params } = request;
        // Notifications have no id and need no response
        if (id === undefined || id === null) {
            if (method === 'notifications/initialized') {
                return null;
            }
            return null;
        }
        try {
            switch (method) {
                case 'initialize': {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            protocolVersion: params?.protocolVersion || '2024-11-05',
                            capabilities: {
                                tools: {},
                                resources: {},
                            },
                            serverInfo: {
                                name: 'routed',
                                version: this.version,
                            },
                        },
                    };
                }
                case 'ping': {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {},
                    };
                }
                case 'tools/list': {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            tools: [
                                {
                                    name: 'route_skill',
                                    description: 'Route natural language prompts to matching agent skills using hybrid BM25 and dense embeddings. Behavior: Read-only local CPU execution in sub-20ms with zero LLM context tokens. Usage Guidelines: Primary entry point. Use route_skill to match task prompts against skills. Use list_skills to browse skills without a prompt, get_skill for known IDs, or scan_skills to refresh index. Parameters: prompt is the required query; topK (1-10, default 3) sets result limit; host filters environment; explain enables scoring breakdown signals.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            prompt: {
                                                type: 'string',
                                                description: 'The natural language user prompt, coding task, or question to route to relevant skills (required, non-empty string).',
                                            },
                                            topK: {
                                                type: 'number',
                                                description: 'Maximum number of top-matching skills to return. Valid integer range: 1 to 10 (default: 3).',
                                            },
                                            host: {
                                                type: 'string',
                                                description: 'Optional host environment filter to restrict matches to a specific AI tool (e.g. cursor, antigravity, claude-code, gemini-cli, hermes, codegate, openclaw, openmanus, lmstudio, ollama).',
                                            },
                                            explain: {
                                                type: 'boolean',
                                                description: 'When true, includes scoring breakdown signals (exact match score, BM25 lexical score, vector semantic similarity). Default: false.',
                                            },
                                        },
                                        required: ['prompt'],
                                    },
                                },
                                {
                                    name: 'get_skill',
                                    description: 'Retrieve full markdown instructions and manifest for a skill by ID or name. Behavior: Read-only disk read; errors if not found. Usage Guidelines: Use when skill ID or name is already known (e.g. from route_skill or list_skills). Use route_skill to search by prompt intent. Parameters: id matches exact skill ID first, then falls back to case-insensitive name.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            id: {
                                                type: 'string',
                                                description: 'The unique skill ID (e.g. "git-commit-helper") or exact skill name. Case-insensitive lookup (required).',
                                            },
                                        },
                                        required: ['id'],
                                    },
                                },
                                {
                                    name: 'list_skills',
                                    description: 'List and filter all locally indexed agent skills from SQLite. Behavior: Read-only, sub-millisecond query with zero side effects. Usage Guidelines: Use to browse available skills without a prompt. Use scan_skills to refresh index after adding or editing skill files, route_skill to match prompts, or get_skill for specific skill instructions. Parameters: filter (substring search) and host (tool environment) combine as an AND filter. Returns all skills when omitted.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            filter: {
                                                type: 'string',
                                                description: 'Optional substring query matched case-insensitively across skill names, descriptions, and tags.',
                                            },
                                            host: {
                                                type: 'string',
                                                description: 'Optional host environment filter to restrict results to a specific tool (e.g. cursor, antigravity, claude-code, gemini-cli, hermes, codegate, openclaw, openmanus, lmstudio, ollama).',
                                            },
                                        },
                                    },
                                },
                                {
                                    name: 'scan_skills',
                                    description: 'Scan filesystem directories across detected AI coding tools and rebuild the local SQLite index. Behavior: Synchronizes SQLite index in-place from disk in <100ms. Read-only on source skill files. Usage Guidelines: Use to refresh index after adding or editing skill files. Use route_skill or list_skills for querying. Parameters: workspace specifies an absolute directory to include workspace-local skills; scans all global tool paths when omitted.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            workspace: {
                                                type: 'string',
                                                description: 'Optional absolute directory path of a custom workspace to scan. If omitted, scans all standard global and workspace skill directories for detected host tools.',
                                            },
                                        },
                                    },
                                },
                                {
                                    name: 'record_feedback',
                                    description: 'Record user routing corrections to refine scoring weights and learn prompt-to-skill synonyms. Behavior: Local SQLite update in <5ms. Idempotent. Usage Guidelines: Use after route_skill when a user approves or corrects a skill route. Parameters: query is the routed prompt; chosenSkillId is the correct skill identifier.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            query: {
                                                type: 'string',
                                                description: 'The original natural language prompt or task query that was routed by route_skill (required, non-empty string).',
                                            },
                                            chosenSkillId: {
                                                type: 'string',
                                                description: 'The unique skill ID or skill name that correctly handles the query (required, non-empty string).',
                                            },
                                        },
                                        required: ['query', 'chosenSkillId'],
                                    },
                                },
                            ],
                        },
                    };
                }
                case 'tools/call': {
                    const toolName = params?.name;
                    const toolArgs = params?.arguments || {};
                    const resultText = await this.executeTool(toolName, toolArgs);
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: resultText,
                                },
                            ],
                        },
                    };
                }
                case 'resources/list': {
                    const skills = this.db.getAllSkills();
                    const resources = [
                        {
                            uri: 'skills://index',
                            name: 'All Indexed Skills Index',
                            mimeType: 'application/json',
                            description: 'Overview of all locally indexed agent skills.',
                        },
                        ...skills.map((s) => ({
                            uri: `skills://${s.id}`,
                            name: s.name,
                            mimeType: 'text/markdown',
                            description: s.description,
                        })),
                    ];
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: { resources },
                    };
                }
                case 'resources/read': {
                    const uri = params?.uri;
                    if (uri === 'skills://index') {
                        const skills = this.db.getAllSkills();
                        return {
                            jsonrpc: '2.0',
                            id,
                            result: {
                                contents: [
                                    {
                                        uri,
                                        mimeType: 'application/json',
                                        text: JSON.stringify(skills, null, 2),
                                    },
                                ],
                            },
                        };
                    }
                    if (uri?.startsWith('skills://')) {
                        const skillId = uri.replace('skills://', '');
                        const skill = this.db.getSkillById(skillId);
                        if (!skill) {
                            throw new Error(`Skill resource not found: ${skillId}`);
                        }
                        let text = skill.bodyPreview;
                        if (fs.existsSync(skill.path)) {
                            text = fs.readFileSync(skill.path, 'utf-8');
                        }
                        return {
                            jsonrpc: '2.0',
                            id,
                            result: {
                                contents: [
                                    {
                                        uri,
                                        mimeType: 'text/markdown',
                                        text,
                                    },
                                ],
                            },
                        };
                    }
                    throw new Error(`Unknown resource URI: ${uri}`);
                }
                default: {
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: -32601,
                            message: `Method not found: ${method}`,
                        },
                    };
                }
            }
        }
        catch (err) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32000,
                    message: err instanceof Error ? err.message : String(err),
                },
            };
        }
    }
    async executeTool(name, args) {
        switch (name) {
            case 'route_skill': {
                const prompt = String(args.prompt || '');
                const topK = typeof args.topK === 'number' ? args.topK : 3;
                const explain = Boolean(args.explain);
                const hostFilter = args.host ? String(args.host) : undefined;
                if (!prompt) {
                    throw new Error('Prompt argument is required.');
                }
                const result = await this.router.route(prompt, { topK, explain });
                let matches = result.selectedSkills;
                if (hostFilter) {
                    matches = matches.filter((m) => m.skill.sourceHost === hostFilter);
                }
                if (matches.length === 0 || result.isNoSkill) {
                    return JSON.stringify({
                        status: 'no_match',
                        message: 'No specialized skill matched the threshold for this prompt.',
                        query: prompt,
                        matches: [],
                    }, null, 2);
                }
                const outputMatches = matches.map((m) => {
                    let fullContent = m.skill.bodyPreview;
                    if (fs.existsSync(m.skill.path)) {
                        try {
                            fullContent = fs.readFileSync(m.skill.path, 'utf-8');
                        }
                        catch {
                            // fallback to body preview
                        }
                    }
                    return {
                        id: m.skill.id,
                        name: m.skill.name,
                        description: m.skill.description,
                        path: m.skill.path,
                        host: m.skill.sourceHost,
                        score: parseFloat(m.score.toFixed(3)),
                        confidence: parseFloat(m.confidence.toFixed(3)),
                        signals: explain ? m.signals : undefined,
                        instructions: fullContent,
                    };
                });
                return JSON.stringify({
                    status: 'routed',
                    query: prompt,
                    latencyMs: parseFloat(result.executionTimeMs.toFixed(2)),
                    routedSkill: outputMatches[0]?.name || null,
                    matches: outputMatches,
                }, null, 2);
            }
            case 'get_skill': {
                const id = String(args.id || '');
                if (!id) {
                    throw new Error('Skill ID argument is required.');
                }
                const skill = this.db.getSkillById(id) || this.db.getAllSkills().find((s) => s.name.toLowerCase() === id.toLowerCase());
                if (!skill) {
                    throw new Error(`Skill "${id}" not found in local index.`);
                }
                let content = skill.bodyPreview;
                if (fs.existsSync(skill.path)) {
                    try {
                        content = fs.readFileSync(skill.path, 'utf-8');
                    }
                    catch {
                        // fallback
                    }
                }
                return JSON.stringify({
                    id: skill.id,
                    name: skill.name,
                    description: skill.description,
                    path: skill.path,
                    host: skill.sourceHost,
                    tags: skill.tags,
                    aliases: skill.aliases,
                    content,
                }, null, 2);
            }
            case 'list_skills': {
                let skills = this.db.getAllSkills();
                if (args.host) {
                    skills = skills.filter((s) => s.sourceHost === args.host);
                }
                if (args.filter) {
                    const q = String(args.filter).toLowerCase();
                    skills = skills.filter((s) => s.name.toLowerCase().includes(q) ||
                        s.description.toLowerCase().includes(q) ||
                        s.tags.some((t) => t.toLowerCase().includes(q)));
                }
                return JSON.stringify({
                    total: skills.length,
                    skills: skills.map((s) => ({
                        id: s.id,
                        name: s.name,
                        description: s.description,
                        host: s.sourceHost,
                        tags: s.tags,
                    })),
                }, null, 2);
            }
            case 'scan_skills': {
                const envs = detectEnvironments();
                const discovered = this.scanner.scanEnvironments(envs);
                for (const sk of discovered) {
                    this.db.upsertSkill(sk);
                }
                this.router.updateSkills(discovered);
                return JSON.stringify({
                    status: 'success',
                    skillsDiscovered: discovered.length,
                    skillsIndexed: discovered.length,
                }, null, 2);
            }
            case 'record_feedback': {
                const query = String(args.query || '');
                const chosenSkillId = String(args.chosenSkillId || '');
                this.learningStore.recordCorrection(query, chosenSkillId);
                return JSON.stringify({
                    status: 'success',
                    message: 'Feedback correction recorded successfully to local store.',
                }, null, 2);
            }
            default: {
                throw new Error(`Unknown tool name: ${name}`);
            }
        }
    }
}
//# sourceMappingURL=mcp-server.js.map