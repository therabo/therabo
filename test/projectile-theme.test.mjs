import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contributionInvaders, layoutCalendar } from '../.github/scripts/invaders.mjs';
import { createDeployment } from '../.github/scripts/organic-deployment.mjs';
import { projectileShape, projectileVisual } from '../.github/scripts/space-visuals.mjs';

test('desktop/mobile projectiles preserve dark white and inherit the ship foreground in light', async () => {
  const calendar = JSON.parse(await readFile(new URL('../assets/contributions/calendar.json', import.meta.url)));
  const deployment = createDeployment(layoutCalendar(calendar), { seed: '0375e116b1f14dcf318f471fb442383a' });
  for (const mobile of [false, true]) for (const theme of ['dark', 'light']) {
    const rendered = contributionInvaders(calendar, theme, mobile, false, deployment);
    const hull = rendered.match(/<path fill="([^"]+)" opacity="\.9" shape-rendering="geometricPrecision"/);
    const projectiles = rendered.match(/<g class="projectiles" clip-path="url\(#field\)" fill="([^"]+)"/);
    assert.ok(hull && projectiles);
    if (theme === 'light') assert.equal(projectiles[1], hull[1], `light/${mobile}: same resolved theme foreground`);
    assert.equal(projectiles[1], theme === 'dark' ? '#ffffff' : '#182d3b');
    const shots = [...rendered.matchAll(/<path class="projectile"[^>]* d="([^"]+)"/g)];
    assert.equal(shots.length, 39);
    assert.ok(shots.every(s => s[1] === projectileShape));
    assert.deepEqual(projectileVisual, { length: 14.4, thickness: 3.6, color: '#ffffff' });
    assert.match(rendered, /@media\(prefers-reduced-motion:reduce\)\{\.projectiles\{display:none!important\}\}/);
    const stationary = contributionInvaders(calendar, theme, mobile, true, deployment);
    assert.doesNotMatch(stationary, /class="projectiles"|class="ship-entry/);
  }
});
