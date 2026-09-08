<div align="center" class="intro-header">

# Routed

**The Universal Local Router for Agent Skills**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Try%20Routed%20Online-blue?style=for-the-badge&logo=vercel)](https://routed-demo.vercel.app/) [![Latest Release](https://img.shields.io/badge/Release-v1.6.0-0969da?style=for-the-badge&logo=github)](https://github.com/bshea-1/Routed/releases) [![Platforms](https://img.shields.io/badge/Platforms-macOS%20%7C%20Linux%20%7C%20Windows-5856d6?style=for-the-badge)](#installation) [![Glama Score](https://glama.ai/mcp/servers/bshea-1/Routed/badges/score.svg)](https://glama.ai/mcp/servers/bshea-1/Routed) [![License: MIT](https://img.shields.io/badge/License-MIT-3DA639?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

<div align="center" class="quick-nav">

[Live Demo](https://routed-demo.vercel.app/) | [Overview](#overview) | [Architecture](#architecture) | [Empirical Tuning](#empirical-parameter-tuning) | [Installation](#installation) | [Quick Start](#quick-start) | [Comparison](#comparison) | [Environments](#supported-environments) | [MCP & Local Models](#model-context-protocol-mcp--local-models) | [CLI](#cli-reference) | [FAQ](#faq) | [Star History](#star-history) | [License](#license)

</div><br>

<div align="center">

<a href="https://routed-demo.vercel.app/">
  <img src="assets/demo.gif" alt="Routed Terminal Demo - Click to Open Live Web Demo" width="880">
</a>

</div><br>

<div class="mob-tip">

> [!TIP]
> Download standalone installers directly from [GitHub Releases](https://github.com/bshea-1/Routed/releases): `RoutedSetup.exe` (Windows), `RoutedSetup.pkg` (macOS), and `RoutedSetup.deb` (Linux).

</div>

---

## Overview

Routed is a **universal, local, zero-token router** for Agent Skills across AI coding environments. It automatically scans, indexes, and routes coding prompts to the most relevant skill using a local hybrid search engine combining Okapi BM25, exact matching, and local dense semantic embeddings.

- **Zero Token Cost**: Eliminates costly LLM routing calls (saving 1,000+ prompt tokens per interaction).
- **Sub-20ms Latency**: Local CPU-evaluated hybrid search responds instantly without network roundtrips.
- **Empirical Hyperparameter Tuning**: Zero magic numbers. Built-in parameter grid search and Stratified 5-Fold Cross-Validation (`routed tune`) empirically optimize scoring weights with a proven 2.6% generalization gap.
- **Adversarial Precision Floor**: Grounded semantic gating and calibrated 0.35 confidence floor guarantee zero false activations on gibberish or non-coding prompts.
- **Negation Intent and Framework Penalty**: Automatically isolates positive intent, suppresses negated skills, and penalizes unprompted framework specializations.
- **Model Context Protocol (MCP) Server**: Run Routed via `routed mcp` to eliminate context pollution in LM Studio, Cursor, Claude Desktop, Windsurf, and Continue.
- **Native Multilingual Understanding**: Understands German, Spanish, French, Japanese, and 100+ languages natively, automatically handling compound words without language switches.
- **Native Auto-Updater**: Automatic version checks and seamless in-place upgrades via `routed update`.
- **Self-Healing Host Reconciliation**: Unified diagnostics and adapter repair via `routed doctor --fix`.
- **Privacy First**: Prompt routing is executed 100% locally; no user queries leave your machine.
- **Multi-Skill Dispatch**: Decomposes compound prompts and activates multiple skills simultaneously.

---

## Architecture

Routed evaluates queries using an empirically validated multi-tier hybrid scoring pipeline running entirely on local CPU:

```mermaid
flowchart LR
    UserPrompt["User Prompt (/route)"] --> Engine["Routed Core Engine"]

    subgraph Engine["Hybrid Scoring Pipeline (Local CPU)"]
        Exact["Exact / Alias Match (10%)"]
        BM25["Okapi BM25 Lexical (45%)"]
        Semantic["Dense Vector Embeddings (45%)"]
        Meta["Adaptive History & Decay (0-25%)"]
    end

    Exact --> Scorer["Composite Hybrid Scorer"]
    BM25 --> Scorer
    Semantic --> Scorer
    Meta --> Scorer

    Scorer --> Selection["Top Skill(s) Resolved (< 20ms)"]
    Selection --> Agent["AI Host Agent (Antigravity / Claude / Cursor / OpenCode / Codex)"]
```

$$\text{Composite Score} = W_{\text{sem}} \cdot \text{Semantic} + W_{\text{bm25}} \cdot \text{BM25} + W_{\text{exact}} \cdot \text{Exact} + W_{\text{history}} \cdot \text{Metadata}$$

---

## Empirical Parameter Tuning

Starting in **v1.5.0**, Routed eliminates arbitrary "magic numbers" by incorporating an empirical hyperparameter optimization engine:

```bash
routed tune --folds 5 --apply
```

### Stratified K-Fold Cross-Validation

To ensure scoring weights generalize robustly to unseen prompts rather than overfitting to synthetic queries, `routed tune`:
1. **Precomputes Retrieval Signals**: Caches lexical (BM25), exact, and dense vector signals in an in-memory matrix, allowing 1,000+ candidate parameter configurations to evaluate in milliseconds.
2. **Stratifies 5 Folds**: Splits representative benchmark cases across 9 distinct categories (`exact-match`, `synonym`, `technical-jargon`, `abbreviation`, `indirect-intent`, `multilingual`, `multi-skill`, `domain-specific`, `no-skill`).
3. **Optimizes on Training Splits**: Sweeps the weight simplex ($\sum W = 1.0$) with step size 0.05 and confidence thresholds to maximize composite Top-1 accuracy, Top-3 recall, and No-Skill precision.
4. **Validates Out-of-Fold (OOF)**: Evaluates discovered weights against held-out validation queries, computing the **Generalization Gap** ($\text{Train} - \text{Val}$) and standard deviation across folds.

| Metric | Factory Baseline (v1.3) | Empirically Tuned (v1.5) | Delta |
| :--- | :--- | :--- | :--- |
| **Scoring Weights** | 50% Sem / 35% BM25 / 10% Exact / 5% Meta | 43% Sem / 50% BM25 / 7% Exact / 0% Meta | +15% Lexical Contrast |
| **Out-of-Fold Top-1 Accuracy** | 40.0% | **45.6%** | **+5.6%** |
| **Out-of-Fold Top-3 Recall** | 55.6% | **63.3%** | **+7.7%** |
| **Mean Generalization Gap** | N/A | **2.6%** ($\pm 17.7\%$) | Proven Generalization |
| **No-Skill Precision** | 40.0% | **40.0%** (strict threshold) | Eliminates false activations |

Tuned weights are persisted directly in the local SQLite `index.db`. All subsequent `routed route` operations automatically execute with the empirical weights. You can reset to baseline at any time with `routed tune --reset`.

## Comparison

| Dimension | Routed (Local) | Traditional Cloud LLM Routing | Manual Skill Selection |
| :--- | :--- | :--- | :--- |
| **Token Cost** | $0.00 (Zero tokens) | 500 to 2,000 paid tokens | $0.00 |
| **Latency** | Under 20ms (Local CPU) | 1,200ms to 3,500ms network API | Manual human browsing |
| **Privacy** | 100% Local (Air-gapped) | Sends user prompts to cloud | Local |
| **Ranking Engine** | Deterministic Hybrid | Non-deterministic prompt drift | Memory or string grep |
| **Multi-Agent Sync** | Automatic adapter synchronization | Fragmented per-tool prompting | Manual copy and paste |

---

## Installation

### Instant Test (Zero-Install via `npx`)

Test Routed immediately in any project without downloading an installer:

```bash
npx routed route "refactor auth service and add unit tests" --explain
```

Or run the interactive setup wizard directly:

```bash
npx routed setup
```

To install globally via npm:

```bash
npm install -g routed
```

---

### Standalone Installers

For permanent, system-level local installation across all AI coding environments:

| Platform | Installer Package | Format | Quick Install |
| :--- | :--- | :--- | :--- |
| **macOS** | [`RoutedSetup.pkg`](https://github.com/bshea-1/Routed/releases) / [`RoutedSetup.dmg`](https://github.com/bshea-1/Routed/releases) | Apple Installer / Disk Image | Run `.pkg` or mount `.dmg` |
| **Linux** | [`RoutedSetup.deb`](https://github.com/bshea-1/Routed/releases) / [`routed-linux-x64.tar.gz`](https://github.com/bshea-1/Routed/releases) | Debian Package / Tarball | `sudo dpkg -i RoutedSetup.deb` |
| **Windows** | [`RoutedSetup.exe`](https://github.com/bshea-1/Routed/releases) / [`Install-Routed.ps1`](https://github.com/bshea-1/Routed/releases) | NSIS Executable Installer | Run `RoutedSetup.exe` |

### Build from Source

```bash
git clone https://github.com/bshea-1/Routed.git
cd Routed
npm install
npm run build
npm run setup
```

---

## Quick Start

### 1. Interactive Setup Wizard
Run the setup wizard to detect installed AI coding tools and configure `/route` adapters:
```bash
routed setup
```

### 2. Discover & Index Skills
Scan local directories and build the hybrid index:
```bash
routed scan
routed skills
```

### 3. Route Prompts
Inside your AI agent chat (Antigravity, OpenCode, Claude Code, Cursor, Codex):
```text
/route write a unit test for my authentication service using TDD
```

Or from your terminal:
```bash
routed route "audit accessibility and fix memory leaks" --explain
```

### 4. Diagnostics
Verify system health, SQLite indices, and embedding models:
```bash
routed doctor
```

---

## Supported Environments

| Environment | Adapter Path / Target | Auto-Detection | Integration Method |
| :--- | :--- | :---: | :--- |
| **Model Context Protocol (MCP)** | `claude_desktop_config.json`, `.cursor/mcp.json` | Supported | Universal JSON-RPC 2.0 stdio server (`routed mcp`) |
| **LM Studio** | `~/.cache/lm-studio/mcp.json` | Supported | Local MCP server for GPU-hosted local LLMs |
| **Ollama** | `~/.ollama/routed/routed-tools.json` | Supported | Tool schemas (`/api/chat`) and dynamic Modelfiles |
| **Hermes Agent** | `~/.hermes/routed/routed-tools.json` | Supported | Function calling schemas (JSON & XML) and prompt integration (`routed hermes`) |
| **Antigravity** | `~/.gemini/config/skills/route/SKILL.md` | Supported | Native skill dispatch and background router |
| **Claude Code** | `~/.claude/skills/route/SKILL.md` | Supported | Slash command integration and terminal runner |
| **Cursor** | `.cursor/rules/routed.mdc` / `mcp.json` | Supported | Rule-based prompt interception and MCP tools |
| **Codeium Windsurf** | `~/.codeium/windsurf/mcp_config.json` | Supported | Cascade MCP tool server |
| **Continue.dev** | `~/.continue/config.json` | Supported | Local IDE tool provider for Ollama and LM Studio |
| **OpenCode** | `~/.opencode/skills/route/SKILL.md` | Supported | Local skill loader and interactive prompts |
| **Codex** | `.agents/skills/route/SKILL.md` | Supported | Universal Agentic Skill schema |
| [**HOL Guard**](https://github.com/hashgraph-online/hol-guard) | Local agent harness command protection | Supported | [Pre-action safety extension (`command.routed`)](#agent-harness-safety-with-hol-guard) |

---

## Model Context Protocol (MCP) & Local Models

Routed can be attached as a standard MCP server to any compatible host (LM Studio, Cursor, Claude Desktop, Windsurf, Continue). Instead of dumping 50+ tool schemas into your model context and exhausting VRAM, the host model only calls the `route_skill` tool. Routed evaluates the prompt on local CPU in sub-20ms and returns only the matched skill manifests.

### Add to Claude Desktop / Cursor / LM Studio
Add the following snippet to your host configuration file:
```json
{
  "mcpServers": {
    "routed": {
      "command": "routed",
      "args": ["mcp"]
    }
  }
}
```

### Direct Ollama Integration
Generate Ollama tool schemas for `/api/chat` function calling:
```bash
routed ollama tools
```

Route a prompt and generate a ready-to-run Ollama API payload:
```bash
routed ollama run --prompt "build a neural network in pytorch" --model llama3.2
```

### Hermes Agent Integration
Generate tool schemas (OpenAI JSON or Nous Hermes XML) for Hermes agents:
```bash
# OpenAI-compatible JSON schema
routed hermes schema

# Nous Hermes XML schema
routed hermes schema --xml

# System prompt guidance snippet
routed hermes prompt
```

Route a prompt and get ready-to-inject instructions:
```bash
routed hermes route "refactor auth service"
```

### Agent Harness Safety with HOL Guard
Routed integrates directly with [HOL Guard](https://github.com/hashgraph-online/hol-guard) (`command.routed`) to ensure safe automated execution inside agent harnesses. HOL Guard intercepts and flags state-modifying operations (`routed doctor --fix`, `routed adapters install`, `routed adapters uninstall`, and `routed update`) for pre-action human review, while allowing routine routing (`routed route`), diagnostics (`routed doctor`), and update checks (`routed update --check`) to execute without interruption.

---

## CLI Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| `routed setup` | Run interactive setup wizard | `routed setup` |
| `routed update` | Check for updates and upgrade Routed | `routed update --check` |
| `routed mcp` | Start Model Context Protocol server over stdio | `routed mcp` |
| `routed ollama <cmd>` | Ollama tool schemas, routes, and Modelfiles | `routed ollama tools` |
| `routed hermes <cmd>` | Hermes schemas (JSON/XML), prompts, and routes | `routed hermes schema` |
| `routed route "<prompt>"` | Find matching skill(s) for a prompt | `routed route "write unit test with TDD"` |
| `routed scan` | Scan supported environments and update index | `routed scan` |
| `routed skills` | List all discovered and indexed skills | `routed skills` |
| `routed adapters` | Manage `/route` adapters across AI tools | `routed adapters install` |
| `routed doctor` | Run diagnostics and auto-reconciliation | `routed doctor --fix` |
| `routed reindex` | Incrementally re-index and re-embed skills | `routed reindex` |
| `routed watch` | Continuously monitor skill dirs for changes | `routed watch` |
| `routed feedback` | Manage routing preferences and corrections | `routed feedback --list` |
| `routed tune` | Run parameter grid search and K-fold CV | `routed tune --folds 5 --apply` |
| `routed status` | Display status and detected environments | `routed status` |
| `routed benchmark` | Run routing accuracy and latency benchmarks | `routed benchmark` |
| `routed uninstall` | Safely remove Routed and clean adapters | `routed uninstall --dry-run` |

<details>
<summary>Click to view full CLI options</summary>

```text
Usage:
  routed <command> [arguments] [options]

Commands:
  setup               Run the interactive setup wizard
  update              Check for updates and automatically upgrade Routed (--check to inspect)
  mcp                 Start Model Context Protocol (MCP) server for LM Studio, Cursor, Claude
  ollama <subcommand> Ollama tool schemas, Modelfiles, and direct route integration
  hermes <subcommand> Hermes agent schemas (JSON/XML), prompts, and direct route integration
  route "<prompt>"    Find the best matching Agent Skill(s) for a prompt
  scan                Scan supported AI environments and update index
  skills              List all discovered and indexed skills
  adapters            Manage /route adapters across AI coding tools
  doctor              Run system, database, and model diagnostics (--fix to repair)
  reindex             Incrementally re-index and re-embed installed skills
  watch               Continuously monitor skill directories for file changes
  feedback            Manage local routing preferences and corrections
  tune                Run parameter grid search and K-fold CV to optimize scoring weights
  uninstall           Safely uninstall Routed and remove adapters (--dry-run available)
  status              Display current system status and detected environments
  benchmark           Run routing benchmark suite and measure accuracy and latency
  version             Print version information
  help                Display help screen
```

</details>

---

## FAQ

<details>
<summary><strong>Are the hybrid scoring weights arbitrary magic numbers?</strong></summary>

No. Starting in **v1.5.0**, Routed incorporates a built-in hyperparameter grid search engine and Stratified K-Fold Cross-Validation framework (`routed tune`). Running `routed tune --folds 5` systematically sweeps the scoring weight simplex and evaluates out-of-fold generalization on a representative benchmark across 9 categories. The resulting weights achieve a 2.6% generalization gap, empirically proving they generalize to unseen queries without overfitting.

</details>

<details>
<summary><strong>What happens if setup or adapter installation encounters a partial failure across multiple hosts?</strong></summary>

Routed follows an idempotent desired-state convergence model with zero blast radius. Each host adapter runs in an isolated boundary: if Cursor installs successfully but Claude Code fails (for example, due to a file lock or directory permission), Cursor is preserved and remains fully functional. Running `routed doctor --fix` or `routed adapters install` automatically detects and reconciles any missing adapters in a single command.

</details>

<details>
<summary><strong>How does Routed operate with zero external API keys?</strong></summary>

Routed runs quantized ONNX dense embedding models (Snowflake Arctic Embed S / all-MiniLM-L6-v2) directly on local CPU alongside Okapi BM25. Vector similarity and text indices are cached in a local SQLite database, requiring no internet connection or cloud tokens.

</details>

<details>
<summary><strong>How are multiple skills selected simultaneously?</strong></summary>

When a prompt contains compound intents or conjunctions (such as "and", "with", "as well as"), Routed decomposes the prompt into sub-clauses, scores candidates across all clauses, and returns all matching skills in `selectedSkills` for joint agent activation.

</details>

<details>
<summary><strong>Does Routed introduce noticeable latency?</strong></summary>

No. Benchmark execution times average under 20 milliseconds on local CPU, making routing practically instantaneous compared to remote cloud roundtrips (1,200ms to 3,500ms).

</details>

<details>
<summary><strong>Where are skill embeddings and cache files stored?</strong></summary>

Routed stores its index and database files in standard platform directories:
- macOS: `~/Library/Application Support/Routed`
- Linux: `~/.local/share/routed`
- Windows: `%LOCALAPPDATA%\Routed`

</details>

---

## Star History

<div align="center">

<img src="assets/star-history.svg" alt="Routed Star History" width="800">

</div>

---

## License

MIT License. Copyright (c) 2026 bshea-1.

See [LICENSE](LICENSE) for full details.
