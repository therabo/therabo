// Shared SVG primitives. No web fonts, scripts, foreignObject or remote assets.
const themes = {
  dark: { bg: '#0c1219', surface: '#121d27', text: '#eff4f8', muted: '#a8bac9', line: '#2c414e', accent: '#75e0ca', secondary: '#e2bc8d', grid: '#1b2b36' },
  light: { bg: '#f5f8f9', surface: '#ffffff', text: '#182d3b', muted: '#4d6575', line: '#c4d3da', accent: '#096e5b', secondary: '#865724', grid: '#e0e9ed' },
};

export const escapeXml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

export function text(x, y, value, { size = 20, fill = 'text', weight = 400, mono = false, anchor = 'start', spacing = 0 } = {}) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${mono ? 'monospace' : 'Arial, Helvetica, sans-serif'}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}">${escapeXml(value)}</text>`;
}

export function svg(width, height, title, body, theme = 'dark', description = title) {
  const palette = themes[theme];
  const content = body.replace(/(fill|stroke)="(bg|surface|text|muted|line|accent|secondary|grid)"/g, (_, attr, token) => `${attr}="${palette[token]}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title><desc id="desc">${escapeXml(description)}</desc>
${content}
</svg>\n`;
}

export const frame = (w, h) => `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="16" fill="bg" stroke="line"/>`;

// Local 24-unit line icons; all colors resolve through the profile's theme tokens.
const activityIcons = {
  stars: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  commits: '<path d="M2 12h5m10 0h5"/><circle cx="12" cy="12" r="5"/>',
  prs: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10m12 0v-5a7 7 0 0 0-7-7m3-3-3 3 3 3"/>',
  issues: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4v.1"/>',
  repos: '<path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 14h14M7 3v10m2 8v-4"/>',
};

function activityIcon(name, x, y) {
  return `<g data-metric="${name}" transform="translate(${x} ${y})" fill="none" stroke="${name === 'stars' ? 'secondary' : 'accent'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${activityIcons[name]}</g>`;
}

function calendarDate(date, withYear = false) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

function runDates(run) {
  if (!run.count) return 'No active run';
  if (run.start === run.end) return calendarDate(run.start, true);
  const crossYear = run.start.slice(0, 4) !== run.end.slice(0, 4);
  return `${calendarDate(run.start, crossYear)} – ${calendarDate(run.end, true)}`;
}

export function activityCard(stats, theme, mobile = false) {
  const width = mobile ? 440 : 880;
  const { streaks } = stats;
  const wrappedDates = [streaks.current, streaks.longest].some((run) => runDates(run).length > 22);
  const streakScale = mobile ? .65 : 1;
  const unscaledHeight = mobile ? (wrappedDates ? 510 : 488) : (wrappedDates ? 268 : 260);
  const height = mobile ? Math.ceil(300 + (unscaledHeight - 300) * streakScale) : unscaledHeight;
  const metrics = [
    ['stars', 'Stars received', stats.stars], ['commits', 'Commits', stats.commits],
    ['prs', 'Pull requests', stats.prs], ['issues', 'Issues opened', stats.issues],
    ['repos', 'Repositories', stats.repos],
  ];
  let body = frame(width, height);
  body += text(28, 36, 'PUBLIC ACTIVITY', { size: mobile ? 16 : 13, fill: 'accent', mono: true, spacing: 1 });
  body += text(mobile ? 28 : 454, mobile ? 286 : 36, 'CONTRIBUTION STREAKS', { size: mobile ? 16 * streakScale : 13, fill: 'accent', mono: true, spacing: streakScale });
  body += mobile ? '<path d="M28 254h384" stroke="line"/>' : '<path d="M418 28v214" stroke="line"/>';
  metrics.forEach(([name, label, value], i) => {
    const y = 76 + i * 38;
    const count = new Intl.NumberFormat('en-US', value >= 1_000_000 ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(value);
    body += activityIcon(name, 28, y - 18);
    body += text(66, y, label, { size: mobile ? 21 : 19, fill: 'muted' });
    body += text(mobile ? 412 : 386, y + 1, count, { size: 25, weight: 700, anchor: 'end' });
  });

  const cy = mobile ? 356 : 124;
  const centers = mobile ? [124, 316] : [540, 750];
  for (const [i, [label, run]] of [['Current streak', streaks.current], ['Longest streak', streaks.longest]].entries()) {
    const x = centers[i];
    // A fixed orbital marker echoes the hero instrument; it is not a progress meter.
    let runBody = i === 0 ? `<g transform="translate(${x} ${cy})" fill="none">
    <circle r="48" stroke="line"/>
    <path d="M-48 0a48 48 0 0 1 96 0" stroke="accent" stroke-width="2"/>
    <path d="M-56 0h8m96 0h8M0-56v8" stroke="accent"/>
    <circle cx="0" cy="48" r="3" fill="secondary"/>
  </g>` : '';
    const size = run.count > 999 ? 30 : run.count > 99 ? 38 : 44;
    runBody += text(x, cy + 3, run.count, { size, weight: 700, fill: i === 0 ? 'accent' : 'text', anchor: 'middle' });
    runBody += text(x, cy + 32, run.count === 1 ? 'day' : 'days', { size: mobile ? 17 : 15, fill: 'muted', anchor: 'middle' });
    runBody += text(x, cy + 77, label, { size: mobile ? 21 : 19, weight: 700, anchor: 'middle' });
    const dates = runDates(run);
    if (dates.length > 22) {
      runBody += text(x, cy + (mobile ? 103 : 96), calendarDate(run.start, true), { size: mobile ? 17 : 14, fill: 'muted', anchor: 'middle' });
      runBody += text(x, cy + (mobile ? 127 : 116), `– ${calendarDate(run.end, true)}`, { size: mobile ? 17 : 14, fill: 'muted', anchor: 'middle' });
    } else {
      runBody += text(x, cy + 103, dates, { size: mobile ? 17 : 15, fill: 'muted', anchor: 'middle' });
    }
    body += mobile ? `<g transform="translate(${x} 300) scale(${streakScale}) translate(${-x} -300)">${runBody}</g>` : runBody;
  }
  return svg(width, height, 'GitHub activity', body, theme,
    metrics.map(([, label, value]) => `${label}: ${value}`).join('. ') + '. '
    + `Current streak: ${streaks.current.count} days (${runDates(streaks.current)}). Longest streak: ${streaks.longest.count} days (${runDates(streaks.longest)}). `
    + `Streaks use the publicly visible contribution calendar from ${streaks.from} through ${streaks.through}, UTC. A zero today preserves yesterday's run.`);
}
