import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export class OllamaAdapter {
    id = 'ollama';
    name = 'Ollama';
    getOllamaDir() {
        return path.join(os.homedir(), '.ollama');
    }
    getRoutedOllamaDir() {
        return path.join(this.getOllamaDir(), 'routed');
    }
    detectHost() {
        const homeDir = this.getOllamaDir();
        return fs.existsSync(homeDir);
    }
    isAdapterInstalled() {
        const helperPath = path.join(this.getRoutedOllamaDir(), 'routed-tools.json');
        return fs.existsSync(helperPath);
    }
    async installAdapter() {
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
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: helperPath,
                message: `Failed to install Ollama adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    async uninstallAdapter() {
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
        }
        catch (err) {
            return {
                hostId: this.id,
                name: this.name,
                success: false,
                adapterPath: outDir,
                message: `Failed to uninstall Ollama adapter: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    getStatus() {
        return {
            hostId: this.id,
            name: this.name,
            isHostDetected: this.detectHost(),
            isAdapterInstalled: this.isAdapterInstalled(),
            adapterPath: path.join(this.getRoutedOllamaDir(), 'routed-tools.json'),
        };
    }
}
//# sourceMappingURL=ollama.js.map