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

export function activityCard(stats, theme, mobile = false) {
  const width = mobile ? 440 : 880;
  const height = mobile ? 360 : 210;
  const metrics = [
    ['Repositories', stats.repos], ['Stars received', stats.stars],
    ['Indexed commits', stats.commits], ['Pull requests', stats.prs], ['Issues opened', stats.issues],
  ];
  let body = frame(width, height) + text(24, 33, '@therabo / PUBLIC GITHUB', { size: 14, mono: true, fill: 'accent', spacing: 1 });
  metrics.forEach(([label, value], i) => {
    const x = mobile ? 24 + (i % 2) * 210 : 24 + i * 172;
    const y = mobile ? 88 + Math.floor(i / 2) * 85 : 100;
    body += text(x, y, new Intl.NumberFormat('en-US').format(value), { size: mobile ? 34 : 36, weight: 700 });
    body += text(x, y + 27, label, { size: mobile ? 18 : 16, fill: 'muted' });
    if (!mobile && i < 4) body += `<path d="M${x + 150} 64v76" stroke="line"/>`;
  });
  body += `<path d="M24 ${height - 48}H${width - 24}" stroke="line"/>`;
  body += text(24, height - 23, mobile ? 'Public data · commits indexed by GitHub Search' : 'PUBLIC DATA ONLY  /  Commits indexed on default branches by GitHub Search.', { size: mobile ? 13 : 14, fill: 'muted', mono: !mobile });
  return svg(width, height, 'Daniel Rabottini — public GitHub activity', body, theme,
    metrics.map(([label, value]) => `${label}: ${value}`).join('. ') + '. Public data only. Commit search covers indexed default branches, not every lifetime commit.');
}
