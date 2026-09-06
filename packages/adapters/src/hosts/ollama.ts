import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HostAdapter, AdapterStatus, AdapterInstallResult, AdapterUninstallResult } from '../types.js';

export class OllamaAdapter implements HostAdapter {
    public id = 'ollama' as const;
    public name = 'Ollama';

    private getOllamaDir(): string {
        return path.join(os.homedir(), '.ollama');
    }

    private getRoutedOllamaDir(): string {
        return path.join(this.getOllamaDir(), 'routed');
    }

    public detectHost(): boolean {
        const homeDir = this.getOllamaDir();
        return fs.existsSync(homeDir);
    }

    public isAdapterInstalled(): boolean {
        const helperPath = path.join(this.getRoutedOllamaDir(), 'routed-tools.json');
        return fs.existsSync(helperPath);
    }

    public async installAdapter(): Promise<AdapterInstallResult> {
        const outDir = this.getRoutedOllamaDir();
        const helperPath = path.join(outDir, 'routed-tools.json');
        const modelfileSnippetPath = path.join(outDir, 'Modelfile.snippet');

        try {
            fs.mkdirSync(outDir, { recursive: true });

            // Write Ollama Tool Calling schema definition for routed meta-tool
            const toolSchema = {
                type: 'function',
                function: {
                    name: 'route_skill',
                    description: 'Select and load specialized agent skills into context based on the current prompt, running locally on CPU in sub-20ms.',
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
            };
            fs.writeFileSync(helperPath, JSON.stringify([toolSchema], null, 2), 'utf-8');

            // Write Modelfile snippet
            const snippet = `# Routed Modelfile Integration for Ollama
# Add this line to your custom Modelfile:
# SYSTEM """You are an intelligent AI assistant equipped with Routed local skill discovery. When a task requires specialized workflows, call the route_skill tool."""
`;
            fs.writeFileSync(modelfileSnippetPath, snippet, 'utf-8');

            return {
                hostId: this.id,
                name: this.name,
                success: true,
                adapterPath: helperPath,
                message: `Configured Ollama tool definitions and Modelfile integration at ${outDir}. Use with 'routed ollama run' or directly in Ollama API /api/chat.`,
            };
        } catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: helperPath,
                message: `Failed to install Ollama adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    public async uninstallAdapter(): Promise<AdapterUninstallResult> {
        const outDir = this.getRoutedOllamaDir();
        try {
            if (fs.existsSync(outDir)) {
                fs.rmSync(outDir, { recursive: true, force: true });
            }
            return {
                hostId: this.id,
                name: this.name,
                success: true,
                adapterPath: outDir,
                message: 'Removed Routed helper files from ~/.ollama/routed.',
            };
        } catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: outDir,
                message: `Failed to uninstall Ollama adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    public getStatus(): AdapterStatus {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: path.join(this.getRoutedOllamaDir(), 'routed-tools.json'),
        };
    }
}
