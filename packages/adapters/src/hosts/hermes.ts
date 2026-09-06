import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';

export class HermesAdapter implements HostAdapter {
    public id = 'hermes' as const;
    public name = 'Hermes';

    private getHermesDir(): string {
        return path.join(os.homedir(), '.hermes');
    }

    private getRoutedHermesDir(): string {
        return path.join(this.getHermesDir(), 'routed');
    }

    public detectHost(): boolean {
        const homeDir = this.getHermesDir();
        const wsDir = path.join(process.cwd(), '.hermes');
        return fs.existsSync(homeDir) || fs.existsSync(wsDir);
    }

    public isAdapterInstalled(): boolean {
        const helperPath = path.join(this.getRoutedHermesDir(), 'routed-tools.json');
        return fs.existsSync(helperPath);
    }

    public async installAdapter(): Promise<AdapterInstallResult> {
        const outDir = this.getRoutedHermesDir();
        const jsonToolsPath = path.join(outDir, 'routed-tools.json');
        const xmlToolsPath = path.join(outDir, 'hermes-tools.xml');
        const systemPromptPath = path.join(outDir, 'system-prompt.txt');

        try {
            fs.mkdirSync(outDir, { recursive: true });

            // 1. OpenAI-compatible JSON tool format
            const jsonToolSchema = [
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
            fs.writeFileSync(jsonToolsPath, JSON.stringify(jsonToolSchema, null, 2), 'utf-8');

            // 2. Nous Hermes XML Function Format
            const xmlToolSchema = `<tools>
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
            fs.writeFileSync(xmlToolsPath, xmlToolSchema, 'utf-8');

            // 3. System prompt guidance snippet for Hermes models
            const systemPrompt = `You have access to the following tool to dynamically load specialized skills:
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

When the user asks you to perform a task that may require specialized domain knowledge or workflows, call the route_skill tool with the user's prompt before taking action.`;
            fs.writeFileSync(systemPromptPath, systemPrompt, 'utf-8');

            return {
                hostId: this.id,
                name: this.name,
                success: true,
                adapterPath: jsonToolsPath,
                message: `Configured Hermes tool schemas (JSON & XML) and system prompt at ${outDir}. Use with 'routed hermes' or in Hermes function-calling loops.`,
            };
        } catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: jsonToolsPath,
                message: `Failed to install Hermes adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    public async uninstallAdapter(): Promise<AdapterUninstallResult> {
        const outDir = this.getRoutedHermesDir();
        try {
            if (fs.existsSync(outDir)) {
                fs.rmSync(outDir, { recursive: true, force: true });
            }
            return {
                hostId: this.id,
                name: this.name,
                success: true,
                adapterPath: outDir,
                message: 'Removed Routed helper files from ~/.hermes/routed.',
            };
        } catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: outDir,
                message: `Failed to uninstall Hermes adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    public getStatus(): AdapterStatus {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: path.join(this.getRoutedHermesDir(), 'routed-tools.json'),
        };
    }
}
