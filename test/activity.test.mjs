import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, collectStats, request } from '../.github/scripts/build-activity-card.mjs';
import { activityCard } from '../.github/scripts/graphics.mjs';

const repo = (stars = 1) => ({ private: false, owner: { login: 'therabo' }, stargazers_count: stars });
test('paginates repositories and explicitly restricts every search to public data', async () => {
  const paths = [];
  const result = await collectStats(async (path) => {
    paths.push(decodeURIComponent(path));
    if (path.includes('/repos?')) return path.endsWith('page=1') ? Array.from({ length: 100 }, () => repo()) : [repo(2)];
    assert.match(decodeURIComponent(path), /author:therabo is:public/);
    return { total_count: 7, incomplete_results: false };
  });
  assert.deepEqual(result, { repos: 101, stars: 102, commits: 7, prs: 7, issues: 7 });
  assert.equal(paths.length, 5);
  assert.ok(paths.some((path) => path.includes('is:pr')));
  assert.ok(paths.some((path) => path.includes('is:issue')));
});

test('rejects private repositories, incomplete results and malformed counts', async () => {
  await assert.rejects(collectStats(async () => [{ ...repo(), private: true }]), /visibility/);
  await assert.rejects(collectStats(async (path) => path.includes('/repos?') ? [] : { incomplete_results: true, total_count: 0 }), /Incomplete/);
  await assert.rejects(collectStats(async () => [repo(-1)]), /Invalid/);
  await assert.rejects(collectStats(async (path) => path.includes('/repos?') ? [] : { incomplete_results: false, total_count: undefined }), /Invalid/);
});

test('retries temporary errors but does not convert unavailable data into zero', async () => {
  let attempts = 0;
  const value = await request('/test', {
    token: '', sleep: async () => {}, fetcher: async () => ++attempts < 3
      ? new Response('', { status: 503 })
      : Response.json({ total_count: 3 }),
  });
  assert.equal(attempts, 3);
  assert.equal(value.total_count, 3);
  await assert.rejects(request('/test', { token: '', sleep: async () => {}, fetcher: async () => new Response('', { status: 403 }) }), /HTTP 403/);
});

test('light/dark and narrow cards are deterministic and keep real zero values', () => {
  const stats = { repos: 0, stars: 0, commits: 0, prs: 0, issues: 0 };
  for (const theme of ['dark', 'light']) for (const mobile of [false, true]) {
    const card = activityCard(stats, theme, mobile);
    assert.equal(card, activityCard(stats, theme, mobile));
    assert.match(card, /Repositories: 0/);
    assert.doesNotMatch(card, /NaN|undefined|foreignObject|<script|@font-face/);
  }
});

test('API failure leaves an existing card byte-for-byte intact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'profile-card-test-'));
  try {
    const file = join(dir, 'activity-card.svg');
    await writeFile(file, '<svg>previous successful card</svg>');
    await assert.rejects(build(dir, async () => { throw new Error('API unavailable'); }), /API unavailable/);
    assert.equal(await readFile(file, 'utf8'), '<svg>previous successful card</svg>');
    assert.deepEqual(await readdir(dir), ['activity-card.svg']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
