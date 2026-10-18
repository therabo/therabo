import test from 'node:test';
import assert from 'node:assert/strict';
import { collectStreaks, deriveStreaks } from '../.github/scripts/activity-streaks.mjs';

function days(from, counts) {
  return counts.map((count, i) => ({ date: new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10), count, level: count ? 1 : 0 }));
}
const streaks = (from, counts) => {
  const list = days(from, counts);
  return deriveStreaks(list, from, list.at(-1).date);
};

test('today, yesterday grace, missed full days and real zeros have distinct meanings', () => {
  assert.deepEqual(streaks('2026-10-14', [0, 1, 4, 2, 1]).current, { count: 4, start: '2026-10-15', end: '2026-10-18' });
  assert.deepEqual(streaks('2026-10-14', [0, 1, 4, 2, 0]).current, { count: 3, start: '2026-10-15', end: '2026-10-17' });
  assert.deepEqual(streaks('2026-10-14', [0, 1, 4, 0, 0]).current, { count: 0, start: null, end: null });
  assert.deepEqual(streaks('2026-10-18', [0]).longest, { count: 0, start: null, end: null });
  assert.deepEqual(streaks('2026-10-18', [7]).current, { count: 1, start: '2026-10-18', end: '2026-10-18' });
});

test('streaks cross calendar years and leap days; tied records use the latest run', () => {
  assert.deepEqual(streaks('2025-12-30', [1, 1, 1, 1]).longest, { count: 4, start: '2025-12-30', end: '2026-01-02' });
  assert.equal(streaks('2024-02-28', [1, 1, 1]).longest.end, '2024-03-01');
  assert.deepEqual(streaks('2026-10-12', [1, 1, 0, 1, 1, 0, 0]).longest, { count: 2, start: '2026-10-15', end: '2026-10-16' });
});

test('incomplete coverage, duplicates, malformed counts and dates cannot become zero streaks', () => {
  assert.throws(() => deriveStreaks([], '2026-10-18', '2026-10-18'), /Incomplete/);
  assert.throws(() => deriveStreaks(days('2026-10-17', [1]), '2026-10-18', '2026-10-18'), /missing/);
  assert.throws(() => deriveStreaks(days('2026-10-18', [-1]), '2026-10-18', '2026-10-18'), /Invalid/);
  assert.throws(() => deriveStreaks(days('2026-10-18', [1.5]), '2026-10-18', '2026-10-18'), /Invalid/);
  assert.throws(() => deriveStreaks([{ date: '2026-02-30', count: 1 }], '2026-02-30', '2026-02-30'), /Invalid/);
  assert.throws(() => deriveStreaks([...days('2026-10-17', [1]), ...days('2026-10-17', [1])], '2026-10-17', '2026-10-18'), /missing/);
});

test('collector verifies each year, trims calendar padding and joins a cross-year run', async () => {
  const years = [];
  const result = await collectStreaks('2025-12-30T12:00:00Z', {
    today: '2026-01-02',
    loadYear: async (year) => {
      years.push(year);
      return { user: 'therabo', days: year === 2025 ? days('2025-12-29', [0, 1, 1]) : days('2026-01-01', [1, 1, 0]) };
    },
  });
  assert.deepEqual(years, [2025, 2026]);
  assert.deepEqual(result.longest, { count: 4, start: '2025-12-30', end: '2026-01-02' });
  assert.equal(result.from, '2025-12-30');
  assert.equal(result.through, '2026-01-02');
});

test('collector refuses missing history, wrong identity and invalid account dates', async () => {
  await assert.rejects(collectStreaks('2025-12-30T12:00:00Z', {
    today: '2026-01-02', loadYear: async () => ({ user: 'therabo', days: days('2026-01-01', [1, 1]) }),
  }), /Incomplete/);
  await assert.rejects(collectStreaks('2026-10-18', {
    today: '2026-10-18', loadYear: async () => ({ user: 'other', days: days('2026-10-18', [1]) }),
  }), /identity/);
  for (const created of [undefined, 'invalid', '2026-02-30', '2027-01-01', '2007-01-01']) {
    await assert.rejects(collectStreaks(created, { today: '2026-10-18' }), /date|window/);
  }
});

test('anonymous calendar requests retry transient errors and never send an authorization header', async () => {
  let attempts = 0;
  const result = await collectStreaks('2026-01-01T12:00:00Z', {
    today: '2026-01-01', sleep: async () => {},
    fetcher: async (url, options) => {
      assert.equal(url, 'https://github.com/users/therabo/contributions?from=2026-01-01&to=2026-01-01');
      assert.equal(options.headers.Authorization, undefined);
      if (++attempts < 3) return new Response('', { status: 503 });
      return new Response('<td id="d1" data-date="2026-01-01" data-level="1"></td><tool-tip for="d1">2 contributions on January 1.</tool-tip>');
    },
  });
  assert.equal(attempts, 3);
  assert.equal(result.current.count, 1);
  await assert.rejects(collectStreaks('2026-01-01', {
    today: '2026-01-01', sleep: async () => {}, fetcher: async () => new Response('', { status: 403 }),
  }), /HTTP 403/);
});
