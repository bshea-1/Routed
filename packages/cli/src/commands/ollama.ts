import fs from 'node:fs';
import { HybridRouter, RoutedDatabase } from '@routed/core';

export interface OllamaCommandOptions {
    subcommand?: string;
    prompt?: string;
    model?: string;
}

export async function runOllamaCommand(options: OllamaCommandOptions): Promise<void> {
    const subcommand = options.subcommand || 'tools';
    const db = new RoutedDatabase();
    const skills = db.getAllSkills();
    const router = new HybridRouter(skills, db);

    switch (subcommand) {
        case 'tools': {
            // Generate Ollama-compatible function tool definitions
            const tools = [
                {
                    type: 'function',
                    function: {
                        name: 'route_skill',
                        description: 'Select and load specialized agent skills into context based on the current user prompt. Executes locally on CPU in sub-20ms.',
                        parameters: {
                            type: 'object',
                            properties: {
                                prompt: {
                                    type: 'string',
                                    description: 'The task description or query requiring skills.',
                                },
                            },
                            required: ['prompt'],
                        },
                    },
                },
            ];
            console.log(JSON.stringify(tools, null, 2));
            break;
        }

        case 'route': {
            if (!options.prompt) {
                console.error('Error: Prompt is required for `routed ollama route "<prompt>"`.');
                process.exit(1);
            }
            const result = await router.route(options.prompt, { topK: 2 });
            if (result.selectedSkills.length === 0 || result.isNoSkill) {
                console.log(JSON.stringify({
                    status: 'pass_through',
                    message: 'No specialized skills matched the confidence threshold.',
                    systemPrompt: '',
                }, null, 2));
                return;
            }

            const activeSkill = result.selectedSkills[0];
            let instructions = activeSkill.skill.bodyPreview;
            if (fs.existsSync(activeSkill.skill.path)) {
                try {
                    instructions = fs.readFileSync(activeSkill.skill.path, 'utf-8');
                } catch {
                    // fallback
                }
            }

            const systemPrompt = `[ACTIVE SKILL: ${activeSkill.skill.name}]\n${instructions}`;

            console.log(JSON.stringify({
                status: 'routed',
                skill: activeSkill.skill.name,
                score: activeSkill.score,
                latencyMs: parseFloat(result.executionTimeMs.toFixed(2)),
                ollamaPayload: {
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        {
                            role: 'user',
                            content: options.prompt,
                        },
                    ],
                },
            }, null, 2));
            break;
        }

        case 'modelfile': {
            const modelfile = `# Modelfile for Ollama with Routed Skill Engine
FROM ${options.model || 'llama3.2'}

SYSTEM """You are an expert AI assistant with local skill routing capabilities. When the user asks for specialized coding, debugging, or design tasks, the environment supplies targeted skills from the local index."""
`;
            console.log(modelfile);
            break;
        }

        default: {
            console.log('Usage:');
            console.log('  routed ollama tools              Output Ollama-compatible function schema');
            console.log('  routed ollama route "<prompt>"   Route prompt and output Ollama API payload');
            console.log('  routed ollama modelfile          Generate custom Ollama Modelfile snippet');
            break;
        }
    }
}
