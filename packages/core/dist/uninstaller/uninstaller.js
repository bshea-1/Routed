import fs from 'node:fs';
import { getPaths } from '../config/paths.js';
export class RoutedUninstaller {
    planUninstall(adapterPaths = []) {
        const paths = getPaths();
        const items = [];
        for (const adp of adapterPaths) {
            items.push({
                type: 'adapter',
                path: adp,
                description: `Routed /route adapter at ${adp}`,
                exists: fs.existsSync(adp),
            });
        }
        items.push({
            type: 'database',
            path: paths.databasePath,
            description: 'Local skills index database (index.db)',
            exists: fs.existsSync(paths.databasePath),
        });
        const jsonDb = paths.databasePath.replace(/\.db$/, '.json');
        if (fs.existsSync(jsonDb)) {
            items.push({
                type: 'database',
                path: jsonDb,
                description: 'Local skills index json fallback',
                exists: true,
            });
        }
        const learningPath = paths.learningDbPath.replace(/\.db$/, '.json');
        items.push({
            type: 'database',
            path: learningPath,
            description: 'Local preference learning store (learning.db)',
            exists: fs.existsSync(learningPath),
        });
        items.push({
            type: 'model',
            path: paths.modelDir,
            description: 'Cached semantic model directory',
            exists: fs.existsSync(paths.modelDir),
        });
        items.push({
            type: 'logs',
            path: paths.logsDir,
            description: 'Routed runtime logs directory',
            exists: fs.existsSync(paths.logsDir),
        });
        items.push({
            type: 'config',
            path: paths.configPath,
            description: 'Routed configuration file (config.json)',
            exists: fs.existsSync(paths.configPath),
        });
        items.push({
            type: 'directory',
            path: paths.rootDir,
            description: 'Routed application data root directory',
            exists: fs.existsSync(paths.rootDir),
        });
        return {
            itemsToRemove: items.filter((i) => i.exists),
            protectedPaths: [
                'User custom skills',
                'Third-party Agent Skills',
                'Claude Code configuration',
                'Antigravity configuration',
                'OpenCode configuration',
                'Cursor configuration',
            ],
            totalBytesEstimate: 0,
        };
    }
    executeUninstall(adapterPaths = []) {
        const plan = this.planUninstall(adapterPaths);
        const removedItems = [];
        const failedItems = [];
        for (const item of plan.itemsToRemove) {
            if (item.type === 'directory')
                continue;
            try {
                if (fs.existsSync(item.path)) {
                    const stats = fs.statSync(item.path);
                    if (stats.isDirectory()) {
                        fs.rmSync(item.path, { recursive: true, force: true });
                    }
                    else {
                        fs.unlinkSync(item.path);
                    }
                    removedItems.push(item.path);
                }
            }
            catch (err) {
                failedItems.push(`${item.path} (${err instanceof Error ? err.message : String(err)})`);
            }
        }
        const paths = getPaths();
        try {
            if (fs.existsSync(paths.rootDir)) {
                fs.rmSync(paths.rootDir, { recursive: true, force: true });
                removedItems.push(paths.rootDir);
            }
        }
        catch (err) {
            failedItems.push(`${paths.rootDir} (${err instanceof Error ? err.message : String(err)})`);
        }
        const success = failedItems.length === 0;
        return {
            success,
            removedItems,
            failedItems,
            message: success
                ? `Successfully uninstalled Routed (${removedItems.length} items removed). All user skills and IDE configurations remain untouched.`
                : `Uninstallation completed with ${failedItems.length} warning(s).`,
        };
    }
}
//# sourceMappingURL=uninstaller.js.map