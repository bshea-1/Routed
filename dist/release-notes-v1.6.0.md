Routed v1.6.0: Adversarial Precision Floor, Negation Intent Extraction, and Framework Specificity Penalty

What is New in v1.6.0:

1. Adversarial Precision Floor and Zero-Token Rejection:
- Grounded semantic gating and a calibrated 0.35 confidence floor guarantee zero false activations on gibberish or non-coding queries.
- Prevents context waste by cleanly declining unanchored inputs (e.g. random keyboard smash or dinner queries) with 100% accuracy across benchmark no-skill cases.
- Expanded conversational and trivial prompt filters bypass heavy inference for instant sub-millisecond responses on generic edits.

2. Negation Intent Extraction:
- Analyzes prompts for negative constraints ("do not run a security audit, just rename my variables") and isolates true positive intent.
- Suppresses negated skills from candidate scoring, eliminating inverse ranking regressions where forbidden tools were loaded into agent context.

3. Framework Specificity Penalty:
- Introduces an automated 0.15 specificity penalty for skills targeting specific frameworks (e.g. Laravel, Django, Rails, React, Flutter, Kubernetes) when the user query does not mention that framework.
- Ensures generalized skills win on generic web application prompts, while still awarding top rank when the framework is explicitly requested.

4. Token Provenance in Explain Mode:
- Enhances `routed route --explain` output to explicitly distinguish between direct prompt tokens and expanded ontology synonyms.
- Deduplicates matched tokens and logs applied framework penalties for transparent routing decisions.

5. Calibrated Semantic Vector Space:
- Calibrates dense cosine similarity against model noise baselines to ensure sharp contrast between relevant tools and background noise.
- Validates embedding integrity, boosting benchmark Top-1 Accuracy to 61.1% and Mean Reciprocal Rank to 70.7%.

Download Standalone Installers:
- Windows: RoutedSetup.exe (or run Install-Routed.ps1 in PowerShell)
- macOS: RoutedSetup.pkg (Apple Installer) or RoutedSetup.dmg
- Linux: RoutedSetup.deb (Debian/Ubuntu) or routed-linux-x64.tar.gz
