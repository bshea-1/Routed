import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const REPO = process.env.ROUTED_REPO || 'bshea-1/Routed';
const OUTPUT_FILE = path.resolve('assets/star-history.svg');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

async function fetchStargazersHistory(repo) {
    return new Promise((resolve, reject) => {
        const headers = {
            'User-Agent': 'Routed-Star-History-Generator',
            'Accept': 'application/vnd.github+json',
        };
        if (GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
        }
        const url = `https://api.github.com/repos/${repo}/stargazers/history`;
        https.get(url, { headers }, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`GitHub API returned status ${res.statusCode}`));
                return;
            }
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (Array.isArray(parsed)) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`Unexpected response: ${body.slice(0, 100)}`));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

function renderSvg(history, repoName) {
    const chronological = [...history].reverse();
    const points = [];
    let cumulative = 0;

    for (const weekEntry of chronological) {
        const weekStartMs = weekEntry.week * 1000;
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const dayMs = weekStartMs + dayIndex * 86400 * 1000;
            const dailyStars = weekEntry.days[dayIndex] || 0;
            cumulative += dailyStars;
            points.push({
                date: new Date(dayMs),
                count: cumulative,
            });
        }
    }

    let firstNonZeroIndex = points.findIndex((p) => p.count > 0);
    let trimmedPoints = points;
    if (firstNonZeroIndex > 0) {
        trimmedPoints = points.slice(firstNonZeroIndex - 1);
    } else if (firstNonZeroIndex === -1) {
        trimmedPoints = points.slice(-7);
    }

    if (trimmedPoints.length === 1) {
        const single = trimmedPoints[0];
        const dayBefore = new Date(single.date.getTime() - 86400 * 1000);
        trimmedPoints = [{ date: dayBefore, count: 0 }, single];
    }

    const totalStars = cumulative;
    const width = 800;
    const height = 360;
    const padLeft = 65;
    const padRight = 35;
    const padTop = 60;
    const padBottom = 50;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const maxStars = Math.max(totalStars, 5);
    const minStars = 0;

    const firstTime = trimmedPoints[0].date.getTime();
    const lastTime = trimmedPoints[trimmedPoints.length - 1].date.getTime();
    const timeSpan = Math.max(lastTime - firstTime, 86400 * 1000);

    const coords = trimmedPoints.map((p) => {
        const x = padLeft + ((p.date.getTime() - firstTime) / timeSpan) * plotWidth;
        const y = padTop + plotHeight - ((p.count - minStars) / (maxStars - minStars)) * plotHeight;
        return { x, y, p };
    });

    const linePathD = coords.reduce((acc, c, idx) => {
        return idx === 0 ? `M ${c.x.toFixed(1)},${c.y.toFixed(1)}` : `${acc} L ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    }, '');

    const lastCoord = coords[coords.length - 1];
    const firstCoord = coords[0];
    const areaPathD = `${linePathD} L ${lastCoord.x.toFixed(1)},${(padTop + plotHeight).toFixed(1)} L ${firstCoord.x.toFixed(1)},${(padTop + plotHeight).toFixed(1)} Z`;

    const yTicks = [];
    const step = Math.ceil(maxStars / 4);
    for (let s = 0; s <= maxStars; s += step) {
        yTicks.push(s);
    }
    if (yTicks[yTicks.length - 1] < maxStars) {
        yTicks.push(maxStars);
    }

    const yTickLines = yTicks.map((val) => {
        const y = padTop + plotHeight - ((val - minStars) / (maxStars - minStars)) * plotHeight;
        return `
        <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" stroke="var(--grid-line)" stroke-dasharray="3,3" />
        <text x="${padLeft - 12}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="tick-label">${val}</text>
        `;
    }).join('\n');

    const numXTicks = Math.min(trimmedPoints.length, 5);
    const xTickIndices = [0];
    if (numXTicks > 2) {
        const middleStep = Math.floor((trimmedPoints.length - 1) / (numXTicks - 1));
        for (let k = 1; k < numXTicks - 1; k++) {
            xTickIndices.push(k * middleStep);
        }
    }
    xTickIndices.push(trimmedPoints.length - 1);
    const uniqueXTickIndices = [...new Set(xTickIndices)];

    const xTickLines = uniqueXTickIndices.map((idx) => {
        const c = coords[idx];
        const d = c.p.date;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`;
        return `
        <line x1="${c.x.toFixed(1)}" y1="${padTop + plotHeight}" x2="${c.x.toFixed(1)}" y2="${padTop + plotHeight + 6}" stroke="var(--grid-line)" />
        <text x="${c.x.toFixed(1)}" y="${padTop + plotHeight + 22}" text-anchor="middle" class="tick-label">${label}</text>
        `;
    }).join('\n');

    const dots = coords.filter((_, i) => i === 0 || i === coords.length - 1 || coords[i].p.count !== coords[i - 1]?.p.count).map((c) => {
        return `
        <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.5" class="data-dot" />
        <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2" class="data-dot-center" />
        `;
    }).join('\n');

    return `<!-- Stargazers History Chart generated directly from GitHub API GET /repos/${repoName}/stargazers/history -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      :root {
        --bg-color: #0d1117;
        --card-border: #30363d;
        --grid-line: #21262d;
        --axis-color: #30363d;
        --text-primary: #f0f6fc;
        --text-secondary: #8b949e;
        --line-stroke: #58a6ff;
        --dot-border: #58a6ff;
        --dot-center: #ffffff;
        --badge-bg: #161b22;
        --badge-border: #388bfd;
        --badge-text: #58a6ff;
        --grad-stop1: rgba(88, 166, 255, 0.35);
        --grad-stop2: rgba(88, 166, 255, 0.00);
      }
      @media (prefers-color-scheme: light) {
        :root {
          --bg-color: #ffffff;
          --card-border: #d0d7de;
          --grid-line: #eaeef2;
          --axis-color: #d0d7de;
          --text-primary: #1f2328;
          --text-secondary: #656d76;
          --line-stroke: #0969da;
          --dot-border: #0969da;
          --dot-center: #ffffff;
          --badge-bg: #f6f8fa;
          --badge-border: #0969da;
          --badge-text: #0969da;
          --grad-stop1: rgba(9, 105, 218, 0.25);
          --grad-stop2: rgba(9, 105, 218, 0.00);
        }
      }
      .bg { fill: var(--bg-color); stroke: var(--card-border); stroke-width: 1; rx: 8; }
      .chart-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; fill: var(--text-primary); }
      .chart-subtitle { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 12px; fill: var(--text-secondary); }
      .tick-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11px; fill: var(--text-secondary); }
      .data-line { fill: none; stroke: var(--line-stroke); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
      .data-area { fill: url(#lineGradient); }
      .data-dot { fill: var(--dot-border); }
      .data-dot-center { fill: var(--dot-center); }
      .badge-rect { fill: var(--badge-bg); stroke: var(--badge-border); stroke-width: 1; rx: 12; }
      .badge-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 600; fill: var(--badge-text); }
    </style>
    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--grad-stop1)" />
      <stop offset="100%" stop-color="var(--grad-stop2)" />
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" class="bg" />

  <!-- Title and Header -->
  <text x="${padLeft}" y="32" class="chart-title">${repoName} Star History</text>
  <text x="${padLeft}" y="48" class="chart-subtitle">Direct weekly stargazer history via GitHub REST API</text>

  <!-- Total Stars Badge -->
  <g transform="translate(${width - padRight - 110}, 20)">
    <rect width="110" height="26" class="badge-rect" />
    <text x="55" y="17" text-anchor="middle" class="badge-text">${totalStars} Stars</text>
  </g>

  <!-- Y Axis Grid and Ticks -->
  <g>${yTickLines}</g>

  <!-- X Axis and Ticks -->
  <line x1="${padLeft}" y1="${padTop + plotHeight}" x2="${width - padRight}" y2="${padTop + plotHeight}" stroke="var(--axis-color)" stroke-width="1.5" />
  <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotHeight}" stroke="var(--axis-color)" stroke-width="1.5" />
  <g>${xTickLines}</g>

  <!-- Gradient Area Under Curve -->
  <path d="${areaPathD}" class="data-area" />

  <!-- Plot Line -->
  <path d="${linePathD}" class="data-line" />

  <!-- Data Points -->
  <g>${dots}</g>
</svg>
`;
}

async function main() {
    console.log(`Fetching stargazers history for ${REPO} from GitHub API...`);
    try {
        const history = await fetchStargazersHistory(REPO);
        console.log(`Received ${history.length} weeks of history.`);
        const svg = renderSvg(history, REPO);
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
        fs.writeFileSync(OUTPUT_FILE, svg, 'utf-8');
        console.log(`Successfully generated star history SVG at ${OUTPUT_FILE}`);
    } catch (err) {
        console.error('Failed to generate star history SVG:', err);
        process.exit(1);
    }
}

main();
