import { RoutedDoctor, DoctorReport } from '@routed/core';
export interface DoctorCommandOptions {
    fix?: boolean;
    json?: boolean;
}
export async function runDoctorCommand(options: DoctorCommandOptions = {}): Promise<DoctorReport> {
    const doctor = new RoutedDoctor();
    if (options.fix) {
        if (!options.json) {
            console.log('\nRunning Routed Doctor auto-repair...');
        }
        const repairRes = await doctor.autoRepair();
        if (!options.json) {
            for (const r of repairRes.repaired) {
                console.log(`  [OK] Repaired: ${r}`);
            }
            for (const f of repairRes.failed) {
                console.log(`  [FAIL] Failed: ${f}`);
            }
        }
    }
    const report = await doctor.runDiagnostics();
    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return report;
    }
    console.log('\nRouted Diagnostics (Spec Section 34)');
    console.log('───────────────────────────────────');
    for (const check of report.checks) {
        let icon = '[OK] OK  ';
        if (check.status === 'warn')
            icon = '[-] WARN';
        if (check.status === 'error')
            icon = '[FAIL] ERR ';
        console.log(`[${icon}] ${check.name.padEnd(28)} ${check.message}`);
    }
    console.log('───────────────────────────────────');
    if (report.allOk) {
        console.log('Result: All systems operational. Routed is healthy.\n');
    }
    else {
        console.log('Result: Issues detected. Run `routed doctor --fix` to attempt auto-repair.\n');
    }
    return report;
}
