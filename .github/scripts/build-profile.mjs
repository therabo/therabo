import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { frame, svg, text } from './graphics.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const assets = resolve(root, 'assets');
await mkdir(assets, { recursive: true });

function instrument(cx, cy, scale = 1) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})" fill="none">
    <path d="M-136 0H136M0-114V114" stroke="line" stroke-dasharray="3 7"/>
    <circle r="83" fill="surface" stroke="line"/>
    <ellipse rx="83" ry="29" stroke="line"/>
    <ellipse rx="30" ry="83" stroke="line"/>
    <ellipse rx="132" ry="44" transform="rotate(-36)" stroke="accent" stroke-width="1.5"/>
    <path d="M-109-68h-26v-24M92 66h38v28M-25 88v25h-63" stroke="line"/>
    <path d="M-68 47l54-66 72 22 36-69" stroke="secondary" stroke-width="1.5"/>
    <circle cx="-68" cy="47" r="4" fill="accent"/><circle cx="-14" cy="-19" r="4" fill="secondary"/>
    <circle cx="58" cy="3" r="4" fill="secondary"/><circle cx="94" cy="-66" r="5" fill="accent"/>
    <circle r="5" stroke="accent"/><path d="M-11 0h22M0-11v22" stroke="accent"/>
  </g>`;
}

function hero(theme, mobile) {
  const w = mobile ? 440 : 880, h = mobile ? 500 : 378, x = mobile ? 28 : 36;
  let body = frame(w, h);
  for (let i = 24; i < w; i += 32) body += `<path d="M${i} 16v${h - 32}" stroke="grid" opacity=".45"/>`;
  for (let i = 24; i < h; i += 32) body += `<path d="M16 ${i}h${w - 32}" stroke="grid" opacity=".45"/>`;
  body += text(x, 42, '@therabo', { size: 18, mono: true, fill: 'accent' });
  body += text(w - x, 42, 'DR / 01', { size: 13, mono: true, fill: 'muted', anchor: 'end' });
  body += text(x, mobile ? 111 : 119, 'Daniel', { size: mobile ? 55 : 64, weight: 700, spacing: -2 });
  body += text(x, mobile ? 167 : 181, 'Rabottini', { size: mobile ? 55 : 64, weight: 700, spacing: -2 });
  body += text(x, mobile ? 213 : 231, 'Software engineering · Applied AI', { size: mobile ? 20 : 21, fill: 'muted' });
  body += text(x, mobile ? 243 : 262, 'Reverse engineering · Cybersecurity', { size: mobile ? 20 : 21, fill: 'muted' });
  if (mobile) {
    body += text(x, 285, 'Computer Science graduate —', { size: 18, fill: 'muted' });
    body += text(x, 313, 'University of Turin', { size: 20, weight: 700 });
    body += instrument(305, 399, .77);
    ['inspect.', 'model.', 'build.'].forEach((v, i) => { body += text(x, 374 + i * 30, v, { size: 19, mono: true, fill: i === 2 ? 'accent' : 'muted' }); });
  } else {
    body += `<text x="${x}" y="307" fill="muted" font-family="Arial, Helvetica, sans-serif" font-size="17">Computer Science graduate — <tspan font-weight="700" fill="text">University of Turin</tspan></text>`;
    body += instrument(693, 171);
    body += text(565, 62, 'SOURCE', { size: 11, mono: true, fill: 'muted' });
    body += text(806, 281, 'SYSTEM', { size: 11, mono: true, fill: 'muted', anchor: 'end' });
    body += text(x, 351, 'INSPECT  /  MODEL  /  BUILD', { size: 14, mono: true, fill: 'accent', spacing: 1 });
  }
  return svg(w, h, 'Daniel Rabottini · @therabo', body, theme,
    'Computer Science graduate — University of Turin. Software engineering, applied AI, reverse engineering and cybersecurity. An original orbital and data-flow instrument: inspect, model, build.');
}

const sections = [['activity', 'Activity', 'PUBLIC GITHUB'], ['contact', 'Contact', 'CONTINUE THE CONVERSATION']];
for (const theme of ['dark', 'light']) {
  const suffix = theme === 'light' ? '-light' : '';
  for (const mobile of [false, true]) {
    const m = mobile ? '-mobile' : '';
    await writeFile(resolve(assets, `profile-header${m}${suffix}.svg`), hero(theme, mobile));
  }
  for (const [i, [id, title, label]] of sections.entries()) {
    let body = text(0, 40, `0${i + 1}`, { size: 16, fill: 'accent', mono: true });
    body += text(46, 41, title, { size: 30, weight: 700, spacing: -.5 });
    body += `<path d="M205 32H880" stroke="line"/>`;
    // Short headers are decorative companions to descriptive image alt text.
    await writeFile(resolve(assets, `section-${id}${suffix}.svg`), svg(880, 64, title, body, theme, label));
    const narrow = text(0, 39, `0${i + 1}`, { size: 15, fill: 'accent', mono: true })
      + text(40, 40, title, { size: 27, weight: 700, spacing: -.5 })
      + `<path d="M188 31H440" stroke="line"/>`;
    await writeFile(resolve(assets, `section-${id}-mobile${suffix}.svg`), svg(440, 60, title, narrow, theme, label));
  }
}

const raw = 'https://raw.githubusercontent.com/therabo/therabo/output';
function picture(base, alt, { mobile = false, dynamic = false } = {}) {
  const path = (m, light) => `${dynamic ? `${raw}/stats` : './assets'}/${base}${m ? '-mobile' : ''}${light ? '-light' : ''}.svg`;
  const sources = [];
  if (mobile) for (const light of [false, true]) sources.push(`  <source media="(max-width: 600px) and (prefers-color-scheme: ${light ? 'light' : 'dark'})" srcset="${path(true, light)}" />`);
  for (const light of [false, true]) sources.push(`  <source media="(prefers-color-scheme: ${light ? 'light' : 'dark'})" srcset="${path(false, light)}" />`);
  return `<picture>\n${sources.join('\n')}\n  <img src="${dynamic ? `./assets/stats/${base}-light.svg` : path(false, true)}" alt="${alt}" width="100%" />\n</picture>`;
}

const parts = [picture('profile-header', 'Daniel Rabottini · @therabo — Computer Science graduate, University of Turin. Software engineering, applied AI, reverse engineering and cybersecurity.', { mobile: true })];
parts.push(picture('section-activity', 'Activity — public GitHub data', { mobile: true }));
parts.push(picture('activity-card', 'GitHub activity: stars received, indexed public commits, public pull requests, issues and owned repositories. Current and longest contribution streaks since account creation, with dates. Updated automatically from public GitHub data and the publicly visible contribution calendar.', { mobile: true, dynamic: true }));
const contributionSources = [];
for (const mobile of [true, false]) for (const stationary of [true, false]) for (const theme of ['dark', 'light']) {
  const media = `${mobile ? '(max-width: 600px) and ' : ''}(prefers-color-scheme: ${theme})${stationary ? ' and (prefers-reduced-motion: reduce)' : ''}`;
  const name = `contribution-invaders${mobile ? '-mobile' : ''}${stationary ? '-static' : ''}-${theme}.svg`;
  contributionSources.push(`  <source media="${media}" srcset="${raw}/contributions/${name}" />`);
}
parts.push(`<picture>\n${contributionSources.join('\n')}\n  <img src="./assets/contributions/contribution-invaders-static-light.svg" alt="Contribution Graph to Invaders: original contribution squares gradually reveal eyes and notches, followed by a slow two-layer starfield. Each active day keeps its contribution color. After the morph, each invader deploys into the right-hand area and follows its own bounded lateral advances, descents and upward recoveries. Reduced motion shows the original static graph." width="100%" />\n</picture>`);
parts.push(picture('section-contact', 'Contact', { mobile: true }));
parts.push('**[LinkedIn ↗](https://www.linkedin.com/in/therabo/)** &nbsp; · &nbsp; **[GitHub ↗](https://github.com/therabo)**');
parts.push('<p><sub>Thanks for visiting.</sub></p>');
await writeFile(resolve(root, 'README.md'), parts.join('\n\n') + '\n');
console.log('Built original light/dark profile assets and README.');
