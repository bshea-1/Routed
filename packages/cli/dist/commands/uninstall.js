import { RoutedUninstaller } from '../../../core/dist/index.js';
import { AdapterRegistry } from '../../../adapters/dist/index.js';
export async function runUninstallCommand(options = {}) {
    const uninstaller = new RoutedUninstaller();
    const registry = new AdapterRegistry();
    const statuses = registry.getStatusList();
    const adapterPaths = statuses
        .filter((s) => s.isAdapterInstalled && s.adapterPath)
        .map((s) => s.adapterPath);
    const plan = uninstaller.planUninstall(adapterPaths);
    if (options.dryRun) {
        if (options.json) {
            console.log(JSON.stringify(plan, null, 2));
            return;
        }
        console.log('\nRouted Uninstallation Plan (Dry Run - Spec Section 36)');
        console.log('────────────────────────────────────────────────────');
        console.log('The following Routed-owned items will be removed:');
        for (const item of plan.itemsToRemove) {
            console.log(`  • [${item.type}] ${item.path}`);
        }
        console.log('\nThe following items are guaranteed NOT to be touched:');
        for (const p of plan.protectedPaths) {
            console.log(`  [OK] ${p}`);
        }
        console.log('\nTo execute uninstallation, run: `routed uninstall` (without --dry-run).\n');
        return;
    }
    console.log('\nUninstalling Routed...');
    const adapterResults = await registry.uninstallAll();
    for (const ar of adapterResults) {
        console.log(`  [OK] Removed adapter: ${ar.name}`);
    }
    const result = uninstaller.executeUninstall(adapterPaths);
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log(`\n${result.message}`);
    console.log('Uninstallation complete. Thank you for using Routed!\n');
}
//# sourceMappingURL=uninstall.js.map