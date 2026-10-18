import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectCalendar, normalizeCalendar } from './contribution-calendar.mjs';
import { contributionInvaders, invadersName, createSceneConfiguration } from './invaders.mjs';
import { createStarfield } from './space-visuals.mjs';

export async function buildInvaders(out = process.env.CONTRIBUTIONS_OUT_DIR || 'dist/contributions', load = async () => process.env.CALENDAR_FILE
  ? normalizeCalendar(JSON.parse(await readFile(process.env.CALENDAR_FILE, 'utf8')))
  : collectCalendar(), options = { seed: process.env.HORDE_SEED || undefined }) {
  const calendar = normalizeCalendar(await load());
  const deployment = createSceneConfiguration(calendar, options);
  const starfield = createStarfield(); // One generation shared by all eight variants.
  // Finish all data validation and rendering before writing any staged file.
  const files = [];
  for (const theme of ['dark', 'light']) for (const mobile of [false, true]) for (const stationary of [false, true]) {
    files.push([invadersName(theme, mobile, stationary), contributionInvaders(calendar, theme, mobile, stationary, deployment, starfield)]);
  }
  files.push(['calendar.json', JSON.stringify(calendar, null, 2) + '\n']);
  await mkdir(out, { recursive: true });
  for (const [name, content] of files) await writeFile(resolve(out, name), content);
  if (deployment.sceneMode === 'METEOR_DODGE') console.log(`Built eight Meteor Dodge/calendar variants; seed ${deployment.seed}, ${deployment.meteors.length} certified meteors.`);
  else console.log(`Built eight Contribution Invaders variants from ${calendar.days.length} actual GitHub days; ${deployment.displayedInvaders} full-size invaders (${deployment.densityMode}); organic seed ${deployment.seed}, attempt ${deployment.attempt}.`);
  return deployment;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildInvaders().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
