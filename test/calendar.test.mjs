import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeCalendar, fromGraphQL, fromPublicHTML, collectCalendar } from '../.github/scripts/contribution-calendar.mjs';
import { layoutCalendar, contributionColors, graph } from '../.github/scripts/contribution-scene.mjs';
import { buildInvaders } from '../.github/scripts/build-contribution-invaders.mjs';

const calendar = () => ({ user: 'therabo', days: Array.from({ length: 365 }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 17 + i)).toISOString().slice(0, 10),
  count: i % 9 === 0 ? 1 : 0, level: i % 9 === 0 ? 1 : 0,
})) });
const response = data => ({ data: { user: { login: 'therabo', contributionsCollection: { contributionCalendar: {
  weeks: [{ contributionDays: data.days.map(d => ({ date: d.date, contributionCount: d.count,
    contributionLevel: ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'][d.level] })) }],
} } } } });

test('calendar validation rejects incorrect identity, invalid dates, gaps, duplicates and levels', () => {
  assert.throws(() => normalizeCalendar({ ...calendar(), user: 'another-user' }), /identity/);
  for (const mutate of [days => { days[0].count = -1; }, days => { days[0].level = 5; },
    days => { days[0].date = '2025-02-30'; }, days => { days[1] = days[0]; }, days => days.splice(1, 1)]) {
    const data = calendar(); mutate(data.days); assert.throws(() => normalizeCalendar(data));
  }
});

test('public HTML and GraphQL preserve actual counts and reject unavailable data', async () => {
  assert.deepEqual(fromGraphQL(response(calendar())), normalizeCalendar(calendar()));
  const html = '<td data-date="2026-10-16" id="day-a" data-level="3"></td><tool-tip for="day-a">12 contributions on October 16th.</tool-tip>';
  assert.equal(fromPublicHTML(html).days[0].count, 12);
  assert.equal(fromPublicHTML(html).days[0].level, 3);
  assert.throws(() => fromPublicHTML(html.replace('12 contributions on', 'Unknown data for')), /unavailable/);
  const result = await collectCalendar({ token: 'unit-test-token', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.github.com/graphql');
    assert.doesNotMatch(JSON.parse(options.body).query, /repositories|email|restrictedContributionsCount/);
    return Response.json(response(calendar()));
  } });
  assert.equal(result.days.length, 365);
  await assert.rejects(collectCalendar({ token: 'unit-test-token', fetcher: async () => Response.json(response({ days: calendar().days.slice(0, 20) })) }), /Incomplete/);
});

test('original complete calendar geometry and colors are shared by desktop/mobile', () => {
  const wide = layoutCalendar(calendar()), mobile = layoutCalendar(calendar(), true);
  assert.deepEqual(wide, mobile);
  assert.deepEqual(graph, { width: 880, height: 192, viewBox: '-16 -32 880 192', size: 12, step: 16, radius: 2 });
  assert.deepEqual([wide[0].x, wide[0].y, wide[2].x, wide[2].y], [2, 82, 18, 2]);
  assert.equal(new Set(wide.map(c => `${c.x}/${c.y}`)).size, 365);
  assert.deepEqual(contributionColors.dark, ['#19232d', '#20443d', '#2f7564', '#49ad92', '#75e0ca']);
  assert.deepEqual(contributionColors.light, ['#e5edf0', '#bfd9d1', '#7bbba8', '#308f76', '#096e5b']);
});

test('calendar acquisition failure preserves the last successful build', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'profile-calendar-'));
  try {
    const file = join(dir, 'contribution-invaders-dark.svg'); await writeFile(file, 'last-good');
    await assert.rejects(buildInvaders(dir, async () => { throw new Error('Calendar unavailable'); }), /unavailable/);
    assert.equal(await readFile(file, 'utf8'), 'last-good');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
