import { RoutedDoctor } from '../../../core/dist/index.js';
import { AdapterRegistry } from '../../../adapters/dist/index.js';
export async function runDoctorCommand(options = {}) {
    const doctor = new RoutedDoctor();
    const registry = new AdapterRegistry();
    if (options.fix) {
        if (!options.json) {
            console.log('\nRunning Routed Doctor auto-repair...');
        }
        const repairRes = await doctor.autoRepair();
        // Check and auto-install missing adapters for all detected host environments
        const statuses = registry.getStatusList();
        for (const st of statuses) {
            if (st.isHostDetected && !st.isAdapterInstalled) {
                const installRes = await registry.install(st.hostId);
                if (installRes.success) {
                    repairRes.repaired.push(`Installed /route adapter for ${st.name}`);
                }
                else {
                    repairRes.failed.push(`Failed to install /route adapter for ${st.name}: ${installRes.message}`);
                }
            }
        }
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
    // Add Adapter Sync check
    const statuses = registry.getStatusList();
    const detectedHosts = statuses.filter((s) => s.isHostDetected);
    const missingAdapters = detectedHosts.filter((s) => !s.isAdapterInstalled);
    if (missingAdapters.length > 0) {
        report.checks.push({
            id: 'adapter-sync',
            category: 'adapters',
            name: 'Adapter Sync Status',
            status: 'warn',
            message: `${missingAdapters.length} detected host(s) missing /route adapter: ${missingAdapters.map((m) => m.name).join(', ')}`,
            fixable: true,
        });
        report.allOk = false;
    }
    else {
        const activeCount = detectedHosts.filter((s) => s.isAdapterInstalled).length;
        report.checks.push({
            id: 'adapter-sync',
            category: 'adapters',
            name: 'Adapter Sync Status',
            status: 'ok',
            message: `All detected host environments have active adapters (${activeCount} active).`,
        });
    }
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
//# sourceMappingURL=doctor.js.map