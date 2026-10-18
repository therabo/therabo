import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { activityCard } from './graphics.mjs';
import { collectStreaks } from './activity-streaks.mjs';

const USER = 'therabo';
const API = 'https://api.github.com';
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

export async function request(path, { token = process.env.GITHUB_TOKEN || '', fetcher = fetch, sleep = delay } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetcher(`${API}${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'therabo-profile-graphics',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      if (attempt === 2) throw new Error('GitHub request failed after three attempts.');
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response.json();
    if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
      throw new Error(`GitHub API returned HTTP ${response.status}. Existing graphics are retained.`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Math.min(15_000, retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt));
  }
}

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label} count; refusing to publish.`);
  return value;
}

export async function collectStats(api = request) {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/users/${USER}/repos?type=owner&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Invalid repository response.');
    for (const repo of batch) {
      if (repo.private !== false || repo.owner?.login?.toLowerCase() !== USER) {
        throw new Error('Unexpected repository visibility or owner; refusing to publish.');
      }
      repos.push(repo);
    }
    if (batch.length < 100) break;
    if (page >= 1000) throw new Error('Repository pagination limit reached.');
  }
  // Sequential search calls reduce pressure on GitHub's separate search rate limit.
  async function search(kind, qualifier) {
    const data = await api(`/search/${kind}?q=${encodeURIComponent(`author:${USER} is:public ${qualifier}`.trim())}&per_page=1`);
    if (data.incomplete_results !== false) throw new Error('Incomplete GitHub search; retaining previous graphics.');
    return count(data.total_count, kind);
  }
  return {
    repos: count(repos.length, 'repositories'),
    stars: count(repos.reduce((sum, repo) => sum + count(repo.stargazers_count, 'stars'), 0), 'total stars'),
    commits: await search('commits', ''),
    prs: await search('issues', 'is:pr'),
    issues: await search('issues', 'is:issue'),
  };
}

export async function build(out = process.env.OUT_DIR || 'dist/stats', api = request, loadStreaks = collectStreaks) {
  const metrics = await collectStats(api);
  const profile = await api(`/users/${USER}`);
  if (profile?.login?.toLowerCase() !== USER) throw new Error('Unexpected streak account identity.');
  const stats = { ...metrics, streaks: await loadStreaks(profile.created_at) };
  // Finish all acquisition, validation and rendering before touching output files.
  const files = [];
  for (const theme of ['dark', 'light']) for (const mobile of [false, true]) {
    const name = `activity-card${mobile ? '-mobile' : ''}${theme === 'light' ? '-light' : ''}.svg`;
    files.push([name, activityCard(stats, theme, mobile)]);
  }
  files.push(['activity.json', JSON.stringify({ schemaVersion: 2, user: USER, data: stats }, null, 2) + '\n']);
  const dir = resolve(out);
  await mkdir(dir, { recursive: true });
  for (const [name, content] of files) await writeFile(resolve(dir, name), content);
  console.log(`Built activity graphics from public GitHub data for @${USER}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  build().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
