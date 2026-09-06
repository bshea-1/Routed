import fs from 'node:fs';
import { HybridRouter, RoutedDatabase } from '../../../core/dist/index.js';

export interface HermesCommandOptions {
    subcommand?: string;
    prompt?: string;
    format?: 'json' | 'xml';
}

export async function runHermesCommand(options: HermesCommandOptions): Promise<void> {
    const subcommand = options.subcommand || 'tools';
    const db = new RoutedDatabase();
    const skills = db.getAllSkills();
    const router = new HybridRouter(skills, db);

    switch (subcommand) {
        case 'tools':
        case 'schema': {
            if (options.format === 'xml') {
                const xmlSchema = `<tools>
  <function>
    <name>route_skill</name>
    <description>Select and load specialized agent skills into context based on the current user prompt. Executes locally on CPU in sub-20ms.</description>
    <parameters>
      <type>object</type>
      <properties>
        <prompt>
          <type>string</type>
          <description>The task description or query requiring skills.</description>
        </prompt>
      </properties>
      <required>
        <item>prompt</item>
      </required>
    </parameters>
  </function>
</tools>`;
                console.log(xmlSchema);
            } else {
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
            }
            break;
        }

        case 'route': {
            if (!options.prompt) {
                console.error('Error: Prompt is required for `routed hermes route "<prompt>"`.');
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
                    // Fall back to bodyPreview
                }
            }

            console.log(JSON.stringify({
                status: 'routed',
                skill: activeSkill.skill.name,
                score: Number(activeSkill.score.toFixed(2)),
                path: activeSkill.skill.path,
                sourceHost: activeSkill.skill.sourceHost,
                systemPrompt: `\n### ACTIVE AGENT SKILL: ${activeSkill.skill.name}\n${instructions}\n`,
            }, null, 2));
            break;
        }

        case 'prompt': {
            console.log(`You have access to the following tool to dynamically load specialized skills:
<tools>
  <function>
    <name>route_skill</name>
    <description>Select and load specialized agent skills into context based on the current user prompt. Executes locally on CPU in sub-20ms.</description>
    <parameters>
      <type>object</type>
      <properties>
        <prompt>
          <type>string</type>
          <description>The task description or query requiring skills.</description>
        </prompt>
      </properties>
      <required>
        <item>prompt</item>
      </required>
    </parameters>
  </function>
</tools>

When a user prompt may require specialized domain knowledge or workflows, invoke route_skill with the prompt to retrieve relevant skill instructions.`);
            break;
        }

        default:
            console.error(`Unknown subcommand: ${subcommand}`);
            console.log('Usage: routed hermes [schema|tools|route|prompt] [arguments]');
            process.exit(1);
    }
}
