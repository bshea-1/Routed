Routed v1.6.5: Dual Evaluation Framework, Grounded Dynamic Floor, and Syntactic Negation Parsing

What is New in v1.6.5:

1. Dual Evaluation Framework (FAR vs FDR):
- Replaces single-sided rejection testing with dual metrics tracking both False Accept Rate (FAR % of no-skill prompts that leak skills) and False Decline Rate (FDR % of valid coding queries dropped by a threshold).
- Evaluated across an expanded 190-case benchmark suite (130 positive coding tasks + 60 adversarial/no-skill traps), delivering 0.0% FAR (0/60 no-skill leaked) and 1.5% FDR (2/130 positive queries dropped).
- Benchmark metrics across 2,130 indexed skills: Top-1 Accuracy 73.2%, Top-3 Recall 83.7%, Top-5 Recall 87.4%, MRR 78.8%, and Composite Score 83.2.

2. Grounded Dynamic Confidence Floor:
- Addresses the confidence floor trade-off where a single fixed threshold either admits gibberish or drops subtle programming requests sitting near the boundary.
- Anchored queries (queries with BM25 lexical match or exact tag/keyword overlap) use a calibrated floor of 0.28 to guarantee valid programming requests are never dropped.
- Unanchored queries (zero lexical overlap, relying purely on dense embedding space) enforce a strict floor of 0.40 to suppress noise and eliminate false activations.

3. Advanced Syntactic and Conditional Negation Parsing:
- Distinguishes direct tool suppression ("do not run a security audit, just rename my variables") from state-preservation verbs ("rename my variables, and if the security audit is already running do not stop it").
- Accurately strips subordinate conditional clauses while preserving process execution state, preventing negated or protected background tools from leaking into context.
- Enforces minimum length rules on compound word decomposition to prevent coincidental substring collisions on short acronyms.

4. Self-Service Reproducible Benchmarks:
- Where to find and run the benchmark yourself:
  - Run directly via the CLI: `routed benchmark` or `routed benchmark --json`
  - Run from the cloned source repository: `npm run benchmark`
  - Benchmark dataset and test suite definition: `packages/core/src/benchmark/dataset.ts`
  - Custom dataset benchmarking: `routed benchmark --dataset <path-to-custom-dataset.json>`

Download Standalone Installers:
- Windows: RoutedSetup.exe (or run Install-Routed.ps1 in PowerShell)
- macOS: RoutedSetup.pkg (Apple Installer) or RoutedSetup.dmg
- Linux: RoutedSetup.deb (Debian/Ubuntu) or routed-linux-x64.tar.gz
