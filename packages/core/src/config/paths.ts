import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
export interface RoutedPaths {
    rootDir: string;
    configPath: string;
    databasePath: string;
    learningDbPath: string;
    logsDir: string;
    adaptersDir: string;
    modelDir: string;
}
export function getRoutedDataDir(): string {
    if (process.env.ROUTED_DATA_DIR) {
        return process.env.ROUTED_DATA_DIR;
    }
    const home = os.homedir();
    const platform = os.platform();
    switch (platform) {
        case 'darwin':
            return path.join(home, 'Library', 'Application Support', 'Routed');
        case 'win32': {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            return path.join(appData, 'Routed');
        }
        case 'linux':
        default: {
            const xdgData = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
            return path.join(xdgData, 'routed');
        }
    }
}
export function getPaths(): RoutedPaths {
    const rootDir = getRoutedDataDir();
    const paths: RoutedPaths = {
        rootDir,
        configPath: path.join(rootDir, 'config.json'),
        databasePath: path.join(rootDir, 'index.db'),
        learningDbPath: path.join(rootDir, 'learning.db'),
        logsDir: path.join(rootDir, 'logs'),
        adaptersDir: path.join(rootDir, 'adapters'),
        modelDir: path.join(rootDir, 'model'),
    };
    return paths;
}
export function ensureDataDirectories(): RoutedPaths {
    const paths = getPaths();
    const dirs = [paths.rootDir, paths.logsDir, paths.adaptersDir, paths.modelDir];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    return paths;
}
