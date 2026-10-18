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
  const height = mobile ? 268 : 124;
  const metrics = [
    ['Repositories', stats.repos], ['Stars received', stats.stars],
    ['Commits', stats.commits], ['Pull requests', stats.prs], ['Issues opened', stats.issues],
  ];
  let body = frame(width, height);
  metrics.forEach(([label, value], i) => {
    const count = new Intl.NumberFormat('en-US').format(value);
    if (mobile) {
      const y = 46 + i * 44;
      body += text(24, y, label, { size: 18, fill: 'muted' });
      body += text(width - 24, y + 1, count, { size: 28, weight: 700, anchor: 'end' });
    } else {
      const x = 24 + i * 172;
      body += text(x, 61, count, { size: 36, weight: 700 });
      body += text(x, 89, label, { size: 16, fill: 'muted' });
      if (i < 4) body += `<path d="M${x + 150} 27v70" stroke="line"/>`;
    }
  });
  return svg(width, height, 'GitHub activity', body, theme,
    metrics.map(([label, value]) => `${label}: ${value}`).join('. ') + '.');
}
