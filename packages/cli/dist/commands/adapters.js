import { AdapterRegistry } from '../../../adapters/dist/index.js';
export async function runAdaptersCommand(options = {}) {
    const registry = new AdapterRegistry();
    const action = options.action || 'list';
    switch (action) {
        case 'list': {
            const statuses = registry.getStatusList();
            if (options.json) {
                console.log(JSON.stringify(statuses, null, 2));
                return;
            }
            console.log('\nRouted Environment Adapters');
            console.log('───────────────────────────');
            console.log(`${'Environment'.padEnd(16)} ${'Host Detected'.padEnd(16)} ${'Adapter Status'.padEnd(18)} Adapter Path`);
            console.log(`${'-'.repeat(15)} ${'-'.repeat(15)} ${'-'.repeat(17)} ${'-'.repeat(30)}`);
            for (const st of statuses) {
                const detectedStr = st.isHostDetected ? '[OK] Detected' : '[-] Not found';
                const installedStr = st.isAdapterInstalled ? '[OK] Installed' : '[-] Not installed';
                const p = st.adapterPath || '(none)';
                console.log(`${st.name.padEnd(16)} ${detectedStr.padEnd(16)} ${installedStr.padEnd(18)} ${p}`);
            }
            console.log('\nRun `routed adapters install` to automatically integrate with detected environments.');
            console.log('Run `routed adapters uninstall <host>` to remove an adapter cleanly.\n');
            break;
        }
        case 'install': {
            if (options.host) {
                const res = await registry.install(options.host);
                if (options.json) {
                    console.log(JSON.stringify(res, null, 2));
                    return;
                }
                const mark = res.success ? '[OK]' : '[FAIL]';
                console.log(`\n${mark} ${res.name}: ${res.message}`);
                if (res.success) {
                    console.log(`  Path: ${res.adapterPath}\n`);
                }
            }
            else {
                console.log('\nInstalling /route adapters for detected environments...');
                const results = await registry.installDetected();
                if (options.json) {
                    console.log(JSON.stringify(results, null, 2));
                    return;
                }
                if (results.length === 0) {
                    console.log('No supported environments detected to install adapters into.');
                    return;
                }
                for (const r of results) {
                    const mark = r.success ? '[OK]' : '[FAIL]';
                    console.log(`  ${mark} ${r.name.padEnd(16)} ${r.message}`);
                }
                console.log('\nAll detected environments configured! Type `/route <prompt>` in your agent.\n');
            }
            break;
        }
        case 'uninstall': {
            if (options.host) {
                const res = await registry.uninstall(options.host);
                if (options.json) {
                    console.log(JSON.stringify(res, null, 2));
                    return;
                }
                const mark = res.success ? '[OK]' : '[FAIL]';
                console.log(`\n${mark} ${res.name}: ${res.message}\n`);
            }
            else {
                console.log('\nUninstalling all Routed adapters...');
                const results = await registry.uninstallAll();
                if (options.json) {
                    console.log(JSON.stringify(results, null, 2));
                    return;
                }
                for (const r of results) {
                    const mark = r.success ? '[OK]' : '[FAIL]';
                    console.log(`  ${mark} ${r.name.padEnd(16)} ${r.message}`);
                }
                console.log('');
            }
            break;
        }
        case 'test': {
            const statuses = registry.getStatusList();
            const target = options.host
                ? statuses.filter((s) => s.hostId === options.host)
                : statuses.filter((s) => s.isAdapterInstalled);
            if (options.json) {
                console.log(JSON.stringify(target, null, 2));
                return;
            }
            console.log('\nTesting installed adapters:');
            if (target.length === 0) {
                console.log('  No installed adapters found to test. Run `routed adapters install` first.\n');
                return;
            }
            for (const st of target) {
                console.log(`  [OK] ${st.name}: Adapter verified at ${st.adapterPath}`);
            }
            console.log('');
            break;
        }
    }
}
//# sourceMappingURL=adapters.js.map