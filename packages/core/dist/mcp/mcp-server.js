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
                                    description: 'Fast local routing engine for Agent Skills. Analyzes a prompt and returns the top matching skills with complete instructions in sub-20ms without burning LLM context window tokens.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            prompt: {
                                                type: 'string',
                                                description: 'The user prompt or task description to route.',
                                            },
                                            topK: {
                                                type: 'number',
                                                description: 'Maximum number of skills to return (default: 3).',
                                            },
                                            host: {
                                                type: 'string',
                                                description: 'Optional host environment filter (e.g. antigravity, cursor, claude-code, lmstudio, ollama).',
                                            },
                                            explain: {
                                                type: 'boolean',
                                                description: 'Include scoring breakdown and matched signals.',
                                            },
                                        },
                                        required: ['prompt'],
                                    },
                                },
                                {
                                    name: 'get_skill',
                                    description: 'Retrieve full markdown instructions and manifest for a specific skill by name or ID.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            id: {
                                                type: 'string',
                                                description: 'The unique skill ID or skill name.',
                                            },
                                        },
                                        required: ['id'],
                                    },
                                },
                                {
                                    name: 'list_skills',
                                    description: 'List all locally indexed agent skills across environments.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            filter: {
                                                type: 'string',
                                                description: 'Optional filter query across names, descriptions, and tags.',
                                            },
                                            host: {
                                                type: 'string',
                                                description: 'Optional host environment filter.',
                                            },
                                        },
                                    },
                                },
                                {
                                    name: 'scan_skills',
                                    description: 'Scan local directories across detected AI coding tools and rebuild the hybrid index.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            workspace: {
                                                type: 'string',
                                                description: 'Optional workspace directory path to scan.',
                                            },
                                        },
                                    },
                                },
                                {
                                    name: 'record_feedback',
                                    description: 'Record user routing feedback to fine-tune local scoring weights and learn local synonyms.',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            query: {
                                                type: 'string',
                                                description: 'The prompt query that was routed.',
                                            },
                                            chosenSkillId: {
                                                type: 'string',
                                                description: 'The correct skill ID.',
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