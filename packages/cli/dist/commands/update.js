import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VERSION } from '../index.js';
import { runDoctorCommand } from './doctor.js';
function parseSemver(v) {
    const clean = v.replace(/^v/, '').trim();
    const parts = clean.split('.').map((p) => parseInt(p, 10));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}
function isNewerVersion(latest, current) {
    const [lMaj, lMin, lPat] = parseSemver(latest);
    const [cMaj, cMin, cPat] = parseSemver(current);
    if (lMaj !== cMaj)
        return lMaj > cMaj;
    if (lMin !== cMin)
        return lMin > cMin;
    return lPat > cPat;
}
export async function fetchLatestRelease() {
    try {
        const res = await fetch('https://api.github.com/repos/bshea-1/Routed/releases/latest', {
            headers: {
                'User-Agent': 'Routed-CLI',
                'Accept': 'application/vnd.github.v3+json',
            },
        });
        if (!res.ok) {
            return null;
        }
        const data = await res.json();
        return {
            tagName: data.tag_name || '',
            version: (data.tag_name || '').replace(/^v/, ''),
            name: data.name || '',
            publishedAt: data.published_at || '',
            body: data.body || '',
            htmlUrl: data.html_url || '',
        };
    }
    catch {
        return null;
    }
}
export async function runUpdateCommand(options = {}) {
    if (!options.json) {
        console.log('\nChecking for Routed updates...');
    }
    const release = await fetchLatestRelease();
    if (!release) {
        if (options.json) {
            console.log(JSON.stringify({ error: 'Unable to reach GitHub Releases API or no releases found.' }, null, 2));
            return;
        }
        console.log('[-] Unable to verify latest release online. Check your internet connection.');
        console.log(`Current version: v${VERSION}\n`);
        return;
    }
    const updateAvailable = isNewerVersion(release.version, VERSION);
    if (options.json) {
        console.log(JSON.stringify({
            currentVersion: `v${VERSION}`,
            latestVersion: release.tagName,
            updateAvailable,
            releaseName: release.name,
            publishedAt: release.publishedAt,
            releaseUrl: release.htmlUrl,
        }, null, 2));
        return;
    }
    if (!updateAvailable) {
        console.log(`[OK] Routed is up to date (v${VERSION}).\n`);
        return;
    }
    console.log(`\n=======================================================`);
    console.log(`  Update Available: ${release.tagName} (Current: v${VERSION})`);
    console.log(`=======================================================`);
    console.log(`Release: ${release.name}`);
    if (release.publishedAt) {
        console.log(`Published: ${new Date(release.publishedAt).toLocaleDateString()}`);
    }
    console.log(`URL: ${release.htmlUrl}\n`);
    if (options.check) {
        console.log('Run `routed update` to install the latest version.\n');
        return;
    }
    console.log('Starting update installation...');
    // Detect installation method
    const cwd = process.cwd();
    const userHome = os.homedir();
    const candidateWorkspace = fs.existsSync(path.join(cwd, 'packages/cli/bin/routed.js'))
        ? cwd
        : fs.existsSync(path.join(userHome, 'routed', 'packages/cli/bin/routed.js'))
            ? path.join(userHome, 'routed')
            : fs.existsSync(path.join(userHome, '.local/share/routed', 'packages/cli/bin/routed.js'))
                ? path.join(userHome, '.local/share/routed')
                : null;
    if (candidateWorkspace && fs.existsSync(path.join(candidateWorkspace, '.git'))) {
        console.log(`Updating via repository at ${candidateWorkspace}...`);
        try {
            execSync('git pull origin main', { cwd: candidateWorkspace, stdio: 'inherit' });
            execSync('npm install --no-audit --no-fund', { cwd: candidateWorkspace, stdio: 'inherit' });
            execSync('npm run build', { cwd: candidateWorkspace, stdio: 'inherit' });
            execSync('node packages/cli/bin/routed.js setup --yes', { cwd: candidateWorkspace, stdio: 'inherit' });
            console.log('\n[OK] Routed upgraded successfully!');
            await runDoctorCommand();
            return;
        }
        catch (err) {
            console.error(`Error updating repository: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    }
    // Direct installer execution
    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';
    if (isMac || isLinux) {
        const scriptName = isMac ? 'install-macos.sh' : 'install-linux.sh';
        const installerUrl = `https://github.com/bshea-1/Routed/releases/download/${release.tagName}/${scriptName}`;
        console.log(`Downloading standalone installer from ${installerUrl}...`);
        try {
            const res = await fetch(installerUrl);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const scriptContent = await res.text();
            const tempScriptPath = path.join(os.tmpdir(), `routed-${scriptName}`);
            fs.writeFileSync(tempScriptPath, scriptContent, { mode: 0o755 });
            execSync(`bash "${tempScriptPath}"`, { stdio: 'inherit' });
            fs.unlinkSync(tempScriptPath);
            console.log('\n[OK] Routed upgraded successfully!');
            return;
        }
        catch (err) {
            console.error(`Failed to run automatic installer: ${err instanceof Error ? err.message : String(err)}`);
            console.log(`You can manually download the latest installer from: ${release.htmlUrl}\n`);
            process.exit(1);
        }
    }
    console.log(`Automatic in-place upgrade is supported on macOS and Linux.`);
    console.log(`To update on Windows, download RoutedSetup.exe from ${release.htmlUrl}\n`);
}
//# sourceMappingURL=update.js.map