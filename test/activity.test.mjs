import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, collectStats, request } from '../.github/scripts/build-activity-card.mjs';
import { activityCard } from '../.github/scripts/graphics.mjs';
import { deriveStreaks } from '../.github/scripts/activity-streaks.mjs';

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
  const streaks = deriveStreaks([{ date: '2026-10-18', count: 0 }], '2026-10-18', '2026-10-18');
  const stats = { repos: 0, stars: 0, commits: 0, prs: 0, issues: 0, streaks };
  for (const theme of ['dark', 'light']) for (const mobile of [false, true]) {
    const card = activityCard(stats, theme, mobile);
    assert.equal(card, activityCard(stats, theme, mobile));
    assert.match(card, /Repositories: 0/);
    assert.match(card, /Current streak: 0 days \(No active run\)/);
    assert.match(card, /Longest streak: 0 days/);
    assert.doesNotMatch(card, /NaN|undefined|foreignObject|<script|@font-face/);
  }
});

test('complete Activity build persists metric scope, streak dates and four variants', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'profile-card-test-'));
  try {
    const api = async (path) => path.includes('/repos?') ? [repo(18)] : path === '/users/therabo'
      ? { login: 'therabo', created_at: '2026-10-18T12:00:00Z' } : { total_count: 7, incomplete_results: false };
    await build(dir, api, async (createdAt) => {
      assert.equal(createdAt, '2026-10-18T12:00:00Z');
      return deriveStreaks([{ date: '2026-10-18', count: 1 }], '2026-10-18', '2026-10-18');
    });
    assert.equal((await readdir(dir)).length, 5);
    const snapshot = JSON.parse(await readFile(join(dir, 'activity.json'), 'utf8'));
    assert.equal(snapshot.schemaVersion, 2);
    assert.equal(snapshot.data.streaks.current.count, 1);
    assert.equal(snapshot.data.streaks.through, '2026-10-18');
    for (const file of (await readdir(dir)).filter((name) => name.endsWith('.svg'))) {
      const svg = await readFile(join(dir, file), 'utf8');
      assert.match(svg, /Current streak: 1 days/);
      assert.match(svg, /Longest streak: 1 days/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('streak collection failure preserves the entire previous Activity set', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'profile-card-test-'));
  const files = ['activity.json', 'activity-card.svg', 'activity-card-light.svg', 'activity-card-mobile.svg', 'activity-card-mobile-light.svg'];
  try {
    for (const file of files) await writeFile(join(dir, file), `previous ${file}`);
    const api = async (path) => path.includes('/repos?') ? [] : path === '/users/therabo'
      ? { login: 'therabo', created_at: '2023-12-29T10:27:18Z' } : { total_count: 0, incomplete_results: false };
    await assert.rejects(build(dir, api, async () => { throw new Error('Incomplete streak history'); }), /Incomplete/);
    for (const file of files) assert.equal(await readFile(join(dir, file), 'utf8'), `previous ${file}`);
    assert.deepEqual((await readdir(dir)).sort(), files.sort());
  } finally { await rm(dir, { recursive: true, force: true }); }
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
