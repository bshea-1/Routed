import { runRoute } from './commands/route.js';
import { runScan } from './commands/scan.js';
import { runSkills } from './commands/skills.js';
import { runStatus } from './commands/status.js';
import { runBenchmarkCommand } from './commands/benchmark.js';
import { runAdaptersCommand, AdaptersCommandOptions } from './commands/adapters.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runReindex } from './commands/reindex.js';
import { runWatch } from './commands/watch.js';
import { runUninstallCommand } from './commands/uninstall.js';
import { runFeedbackCommand } from './commands/feedback.js';
import { runSetupCommand } from './commands/setup.js';
import { runMcpServer } from './commands/mcp.js';
import { runOllamaCommand } from './commands/ollama.js';
import { runHermesCommand } from './commands/hermes.js';
import { runUpdateCommand } from './commands/update.js';
export const VERSION = '1.3.0';
export async function main(args: string[]): Promise<void> {
    const command = args[0];
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        printHelp();
        return;
    }
    if (command === 'version' || command === '--version' || command === '-v') {
        console.log(`routed v${VERSION}`);
        return;
    }
    switch (command) {
        case 'route': {
            const flags = args.slice(1);
            let prompt = '';
            let explain = false;
            let json = false;
            let topK: number | undefined;
            for (let i = 0; i < flags.length; i++) {
                const flag = flags[i];
                if (flag === '--explain') {
                    explain = true;
                }
                else if (flag === '--json') {
                    json = true;
                }
                else if (flag === '--top' && flags[i + 1]) {
                    topK = parseInt(flags[++i], 10);
                }
                else if (!flag.startsWith('-')) {
                    prompt = prompt ? `${prompt} ${flag}` : flag;
                }
            }
            if (!prompt) {
                console.error('Error: Prompt is required for `routed route`.');
                console.error('Usage: routed route "<prompt>" [--explain] [--json]');
                process.exit(1);
            }
            await runRoute({ prompt, explain, json, topK });
            break;
        }
        case 'scan': {
            const flags = args.slice(1);
            let workspace: string | undefined;
            let json = false;
            for (let i = 0; i < flags.length; i++) {
                if (flags[i] === '--workspace' && flags[i + 1]) {
                    workspace = flags[++i];
                }
                else if (flags[i] === '--json') {
                    json = true;
                }
            }
            runScan({ workspace, json });
            break;
        }
        case 'skills': {
            const flags = args.slice(1);
            let filter: string | undefined;
            let host: string | undefined;
            let json = false;
            for (let i = 0; i < flags.length; i++) {
                if (flags[i] === '--filter' && flags[i + 1]) {
                    filter = flags[++i];
                }
                else if (flags[i] === '--host' && flags[i + 1]) {
                    host = flags[++i];
                }
                else if (flags[i] === '--json') {
                    json = true;
                }
            }
            runSkills({ filter, host, json });
            break;
        }
        case 'adapters': {
            const sub = args[1];
            const json = args.includes('--json');
            let action: AdaptersCommandOptions['action'] = 'list';
            let host: string | undefined;
            if (sub === 'install' || sub === 'uninstall' || sub === 'test' || sub === 'list') {
                action = sub;
                host = args[2] && !args[2].startsWith('-') ? args[2] : undefined;
            }
            else if (sub && !sub.startsWith('-')) {
                host = sub;
            }
            await runAdaptersCommand({ action, host, json });
            break;
        }
        case 'doctor': {
            const fix = args.includes('--fix');
            const json = args.includes('--json');
            await runDoctorCommand({ fix, json });
            break;
        }
        case 'reindex': {
            const force = args.includes('--force');
            const json = args.includes('--json');
            await runReindex({ force, json });
            break;
        }
        case 'watch': {
            const quiet = args.includes('--quiet');
            runWatch({ quiet });
            break;
        }
        case 'feedback': {
            let record: string | undefined;
            let skill: string | undefined;
            const clear = args.includes('--clear');
            const list = args.includes('--list');
            const json = args.includes('--json');
            for (let i = 1; i < args.length; i++) {
                if (args[i] === '--record' && args[i + 1]) {
                    record = args[++i];
                }
                else if (args[i] === '--skill' && args[i + 1]) {
                    skill = args[++i];
                }
            }
            runFeedbackCommand({ record, skill, clear, list, json });
            break;
        }
        case 'uninstall': {
            const dryRun = args.includes('--dry-run');
            const json = args.includes('--json');
            await runUninstallCommand({ dryRun, json });
            break;
        }
        case 'benchmark': {
            const json = args.includes('--json');
            await runBenchmarkCommand({ json });
            break;
        }
        case 'setup':
        case 'init': {
            const yes = args.includes('--yes') || args.includes('-y');
            const quiet = args.includes('--quiet') || args.includes('-q');
            await runSetupCommand({ yes, quiet });
            break;
        }
        case 'status': {
            const json = args.includes('--json');
            runStatus({ json });
            break;
        }
        case 'mcp': {
            await runMcpServer();
            break;
        }
        case 'ollama': {
            const sub = args[1];
            const prompt = args[2];
            const model = args[3];
            await runOllamaCommand({ subcommand: sub, prompt, model });
            break;
        }
        case 'hermes': {
            const sub = args[1];
            const prompt = args[2];
            const format = args.includes('--xml') ? 'xml' : 'json';
            await runHermesCommand({ subcommand: sub, prompt, format });
            break;
        }
        case 'update':
        case 'upgrade': {
            const check = args.includes('--check') || args.includes('-c');
            const yes = args.includes('--yes') || args.includes('-y');
            const json = args.includes('--json');
            await runUpdateCommand({ check, yes, json });
            break;
        }
        default:
            console.error(`Unknown command: ${command}`);
            printHelp();
            process.exit(1);
    }
}
function printHelp(): void {
    console.log(`
Routed: Universal local router for Agent Skills (v${VERSION})

Usage:
  routed <command> [arguments] [options]

Commands:
  setup               Interactive 4-screen setup wizard (auto-detects & installs)
  update              Check for updates and automatically upgrade Routed (--check to inspect)
  mcp                 Start Model Context Protocol (MCP) server for LM Studio, Cursor, Claude
  ollama <subcommand> Ollama tool schemas, Modelfiles, and direct route integration
  hermes <subcommand> Hermes agent schemas (JSON/XML), prompts, and direct route integration
  route "<prompt>"    Find the best matching Agent Skill(s) for a prompt
  scan                Scan supported AI environments and update skill index
  skills              List all discovered and indexed skills
  adapters            Manage /route adapters across AI coding tools
  doctor              Run system, database, and model diagnostics (use --fix to repair)
  reindex             Incrementally re-index and re-embed installed skills
  watch               Continuously monitor skill directories for changes
  feedback            Manage local routing preferences and corrections
  uninstall           Safely uninstall Routed and remove adapters (--dry-run available)
  status              Display current system status and detected environments
  benchmark           Run routing benchmark suite and measure accuracy & latency
  version             Print version information
  help                Display this help screen

Options:
  --explain           Show detailed signal breakdown (for 'route')
  --fix               Attempt auto-repair for detected issues (for 'doctor')
  --force             Force complete re-indexing and re-embedding (for 'reindex')
  --dry-run           Simulate uninstallation without modifying files (for 'uninstall')
  --json              Output results in JSON format
  --workspace <path>  Specify a custom workspace path for 'scan'
  --filter <term>     Filter skills by name or keyword
  --host <id>         Filter skills by host (antigravity, claude-code, cursor, opencode, etc.)

Examples:
  routed route "debug memory leaks in node"
  routed doctor --fix
  routed adapters install
  routed reindex
  routed feedback --record "check memory" --skill "memory-leak-debugging"
  routed uninstall --dry-run
`);
}
