// Only the calendar visible on GitHub is retrieved: no repository names or private content.
const USER = 'therabo';
const LEVELS = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
const DAY = 86_400_000;

export function normalizeCalendar(input) {
  if (input.user !== USER || !Array.isArray(input.days) || !input.days.length || input.days.length > 380) {
    throw new Error('Invalid contribution calendar identity or size.');
  }
  const seen = new Set();
  const days = input.days.map(({ date, count, level }) => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date
      || !Number.isSafeInteger(count) || count < 0 || !Number.isInteger(level) || level < 0 || level > 4
      || (count === 0) !== (level === 0) || seen.has(date)) throw new Error('Invalid or duplicate contribution day.');
    seen.add(date);
    return { date, count, level };
  }).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < days.length; i++) {
    if (Date.parse(days[i].date) - Date.parse(days[i - 1].date) !== DAY) throw new Error('Contribution dates are not contiguous.');
  }
  return { schemaVersion: 1, user: USER, source: 'github-contribution-calendar', days };
}

export function fromGraphQL(payload) {
  if (payload.errors?.length) throw new Error('GitHub GraphQL rejected the calendar query.');
  const user = payload.data?.user;
  const weeks = user?.contributionsCollection?.contributionCalendar?.weeks;
  if (user?.login?.toLowerCase() !== USER || !Array.isArray(weeks)) throw new Error('Missing GitHub calendar.');
  const days = weeks.flatMap((week) => {
    if (!Array.isArray(week.contributionDays)) throw new Error('Invalid GitHub calendar week.');
    return week.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS.indexOf(d.contributionLevel) }));
  });
  return normalizeCalendar({ user: USER, days });
}

// Token-free local refresh. Strict parsing fails closed if GitHub changes its public markup.
export function fromPublicHTML(html) {
  const attributes = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const tips = new Map();
  for (const m of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const a = attributes(m[1]);
    const label = m[2].replace(/<[^>]+>/g, '').trim();
    const count = label.match(/^([\d,]+) contributions? on /);
    if (count) tips.set(a.for, Number(count[1].replaceAll(',', '')));
    else if (/^No contributions on /.test(label)) tips.set(a.for, 0);
  }
  const days = [];
  for (const m of html.matchAll(/<td\b([^>]*)>/g)) {
    const a = attributes(m[1]);
    if (!a['data-date']) continue;
    if (!tips.has(a.id)) throw new Error('Public contribution count is unavailable.');
    days.push({ date: a['data-date'], count: tips.get(a.id), level: Number(a['data-level']) });
  }
  return normalizeCalendar({ user: USER, days });
}

export async function collectCalendar({ token = process.env.GITHUB_TOKEN || '', fetcher = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const url = token ? 'https://api.github.com/graphql' : `https://github.com/users/${USER}/contributions`;
  const query = `query($login: String!) { user(login: $login) { login contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount contributionLevel } } } } } }`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetcher(url, {
        method: token ? 'POST' : 'GET',
        headers: { 'User-Agent': 'therabo-contribution-invaders', ...(token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {}) },
        ...(token ? { body: JSON.stringify({ query, variables: { login: USER } }) } : {}),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      if (attempt === 2) throw new Error('Contribution request failed after three attempts.');
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) {
      const calendar = token ? fromGraphQL(await response.json()) : fromPublicHTML(await response.text());
      if (calendar.days.length < 350) throw new Error('Incomplete annual contribution calendar; retaining previous assets.');
      return calendar;
    }
    if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`Calendar request returned HTTP ${response.status}.`);
    await sleep(1000 * 2 ** attempt);
  }
}
