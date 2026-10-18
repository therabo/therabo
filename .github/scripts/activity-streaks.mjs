import { fromPublicHTML, normalizeCalendar } from './contribution-calendar.mjs';

const USER = 'therabo';
const DAY = 86_400_000;
const emptyRun = () => ({ count: 0, start: null, end: null });

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid streak date.');
  }
  return value;
}

// A complete account-history window is required, never an annual proxy.
export function deriveStreaks(days, from, through) {
  dateOnly(from);
  dateOnly(through);
  if (from > through) throw new Error('Invalid streak history window.');
  const expected = (Date.parse(through) - Date.parse(from)) / DAY + 1;
  if (!Array.isArray(days) || days.length !== expected) throw new Error('Incomplete streak history.');
  let run = emptyRun(), longest = emptyRun();
  days.forEach((day, i) => {
    const date = new Date(Date.parse(from) + i * DAY).toISOString().slice(0, 10);
    if (day.date !== date || !Number.isSafeInteger(day.count) || day.count < 0) {
      throw new Error('Invalid or missing streak day.');
    }
    run = day.count > 0 ? { count: run.count + 1, start: run.start || date, end: date } : emptyRun();
    if (run.count > 0 && run.count >= longest.count) longest = { ...run };
  });
  // Today is still open. Yesterday's run remains current until a full day is missed.
  let end = days.length - 1;
  if (days[end].count === 0) end--;
  let current = emptyRun();
  for (let i = end; i >= 0 && days[i].count > 0; i--) {
    current = { count: current.count + 1, start: days[i].date, end: days[end].date };
  }
  return { source: 'github-public-contribution-calendar', from, through, current, longest };
}

async function publicYear(year, through, { fetcher, sleep }) {
  const to = year === Number(through.slice(0, 4)) ? through : `${year}-12-31`;
  const url = `https://github.com/users/${USER}/contributions?from=${year}-01-01&to=${to}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetcher(url, {
        headers: { 'User-Agent': 'therabo-profile-graphics' },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      if (attempt === 2) throw new Error('Streak calendar request failed after three attempts.');
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) return fromPublicHTML(await response.text());
    if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
      throw new Error(`Streak calendar returned HTTP ${response.status}. Existing cards are retained.`);
    }
    await sleep(1000 * 2 ** attempt);
  }
}

export async function collectStreaks(createdAt, {
  today = new Date().toISOString().slice(0, 10),
  fetcher = fetch,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  loadYear = (year, through) => publicYear(year, through, { fetcher, sleep }),
} = {}) {
  if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) throw new Error('Missing account creation date.');
  const from = dateOnly(createdAt.slice(0, 10));
  dateOnly(today);
  if (from > today || from < '2008-01-01') throw new Error('Invalid account history window.');
  const days = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(today.slice(0, 4)); year++) {
    const calendar = normalizeCalendar(await loadYear(year, today));
    const start = year === Number(from.slice(0, 4)) ? from : `${year}-01-01`;
    const end = year === Number(today.slice(0, 4)) ? today : `${year}-12-31`;
    const window = calendar.days.filter((day) => day.date >= start && day.date <= end);
    // Reject empty, wrong-year, truncated or shifted responses before merging years.
    deriveStreaks(window, start, end);
    days.push(...window);
  }
  return deriveStreaks(days, from, today);
}
