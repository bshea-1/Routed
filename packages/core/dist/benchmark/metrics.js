export function evaluatePredictions(cases, predictions) {
    const details = [];
    const latencies = [];
    let top1Matches = 0;
    let top3Matches = 0;
    let top5Matches = 0;
    let sumReciprocalRank = 0;
    let noSkillCases = 0;
    let noSkillMatches = 0;
    let falseDeclines = 0;
    const categoryStats = {};
    for (let i = 0; i < cases.length; i++) {
        const tc = cases[i];
        const pred = predictions[i] || { actual: [], isNoSkill: true };
        const latency = pred.latencyMs ?? 0;
        latencies.push(latency);
        if (!categoryStats[tc.category]) {
            categoryStats[tc.category] = { total: 0, passed: 0 };
        }
        categoryStats[tc.category].total++;
        const actual = pred.actual;
        const normActual = actual.map((a) => a.toLowerCase());
        const normExpected = tc.expectedSkills.map((e) => e.toLowerCase());
        if (tc.expectedSkills.length === 0) {
            noSkillCases++;
            const isMatch = pred.isNoSkill || actual.length === 0;
            if (isMatch) {
                noSkillMatches++;
                top1Matches++;
                top3Matches++;
                top5Matches++;
                sumReciprocalRank += 1.0;
                categoryStats[tc.category].passed++;
            }
            details.push({
                caseId: tc.id,
                prompt: tc.prompt,
                category: tc.category,
                expected: [],
                actual,
                isTop1Match: isMatch,
                isTop3Match: isMatch,
                isTop5Match: isMatch,
                reciprocalRank: isMatch ? 1.0 : 0,
                isNoSkillMatch: isMatch,
                latencyMs: Math.round(latency * 10) / 10,
            });
        }
        else {
            if (actual.length === 0 || pred.isNoSkill) {
                falseDeclines++;
            }
            let rr = 0;
            let top1Match = false;
            let top3Match = false;
            let top5Match = false;
            for (let rank = 0; rank < normActual.length; rank++) {
                const actName = normActual[rank];
                if (normExpected.includes(actName)) {
                    rr = 1.0 / (rank + 1);
                    if (rank === 0)
                        top1Match = true;
                    if (rank < 3)
                        top3Match = true;
                    if (rank < 5)
                        top5Match = true;
                    break;
                }
            }
            if (top1Match) {
                top1Matches++;
                categoryStats[tc.category].passed++;
            }
            if (top3Match)
                top3Matches++;
            if (top5Match)
                top5Matches++;
            sumReciprocalRank += rr;
            details.push({
                caseId: tc.id,
                prompt: tc.prompt,
                category: tc.category,
                expected: tc.expectedSkills,
                actual,
                isTop1Match: top1Match,
                isTop3Match: top3Match,
                isTop5Match: top5Match,
                reciprocalRank: Math.round(rr * 1000) / 1000,
                isNoSkillMatch: false,
                latencyMs: Math.round(latency * 10) / 10,
            });
        }
    }
    latencies.sort((a, b) => a - b);
    const total = cases.length;
    const positiveCases = total - noSkillCases;
    const top1Accuracy = total > 0 ? (top1Matches / total) * 100 : 0;
    const top3Recall = total > 0 ? (top3Matches / total) * 100 : 0;
    const top5Recall = total > 0 ? (top5Matches / total) * 100 : 0;
    const mrr = total > 0 ? (sumReciprocalRank / total) * 100 : 0;
    const noSkillAccuracy = noSkillCases > 0 ? (noSkillMatches / noSkillCases) * 100 : 100;
    const falseAccepts = noSkillCases - noSkillMatches;
    const falseAcceptRate = noSkillCases > 0 ? (falseAccepts / noSkillCases) * 100 : 0;
    const falseDeclineRate = positiveCases > 0 ? (falseDeclines / positiveCases) * 100 : 0;
    // Balanced composite score incorporating Top-1 accuracy, recall, and dual FAR/FDR penalty
    const compositeScore = 0.35 * top1Accuracy +
        0.25 * top3Recall +
        0.15 * mrr +
        0.15 * noSkillAccuracy +
        0.10 * (100 - falseDeclineRate);
    const meanLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const medianLatency = latencies.length > 0 ? latencies[Math.floor(latencies.length / 2)] : 0;
    const categoryBreakdown = {};
    for (const [cat, stat] of Object.entries(categoryStats)) {
        categoryBreakdown[cat] = {
            total: stat.total,
            passed: stat.passed,
            accuracy: Math.round((stat.passed / (stat.total || 1)) * 1000) / 10,
        };
    }
    const metrics = {
        totalCases: total,
        top1Accuracy: Math.round(top1Accuracy * 10) / 10,
        top3Recall: Math.round(top3Recall * 10) / 10,
        top5Recall: Math.round(top5Recall * 10) / 10,
        mrr: Math.round(mrr * 10) / 10,
        noSkillAccuracy: Math.round(noSkillAccuracy * 10) / 10,
        noSkillCases,
        noSkillMatches,
        falseAcceptRate: Math.round(falseAcceptRate * 10) / 10,
        falseDeclineRate: Math.round(falseDeclineRate * 10) / 10,
        falseAccepts,
        falseDeclines,
        positiveCases,
        compositeScore: Math.round(compositeScore * 10) / 10,
        meanLatencyMs: Math.round(meanLatency * 10) / 10,
        medianLatencyMs: Math.round(medianLatency * 10) / 10,
        passedCount: top1Matches,
        failedCount: total - top1Matches,
        categoryBreakdown,
    };
    return { metrics, details };
}
export function computeMetricScore(metrics, metric = 'composite') {
    switch (metric) {
        case 'top1':
            return metrics.top1Accuracy;
        case 'top3':
            return metrics.top3Recall;
        case 'mrr':
            return metrics.mrr;
        case 'f1':
            // Harmonic mean between Top-1 and No-Skill
            const p = metrics.top1Accuracy;
            const r = metrics.noSkillAccuracy;
            return p + r > 0 ? (2 * p * r) / (p + r) : 0;
        case 'composite':
        default:
            return metrics.compositeScore;
    }
}
export function computeStandardDeviation(values) {
    if (values.length <= 1)
        return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}
//# sourceMappingURL=metrics.js.map