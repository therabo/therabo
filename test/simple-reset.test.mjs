import test from 'node:test';
import assert from 'node:assert/strict';
import { planSimpleReset, simpleReset, wrapSimpleReset } from '../.github/scripts/simple-reset.mjs';

const ending = { appearsAt: 69.640182, fadeDuration: .32 };
const plan = planSimpleReset(ending);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('ending-derived fade resets strictly inside full invisibility and holds graph until fade-in ends', () => {
  near(plan.startAt - ending.appearsAt - ending.fadeDuration, 1);
  near(plan.hiddenAt - plan.startAt, .5);
  near(plan.fadeInAt - plan.hiddenAt, .15);
  near(plan.period - plan.fadeInAt, .5);
  near(plan.totalDuration, 1.15);
  assert.ok(plan.resetAt > plan.hiddenAt);
  assert.ok(plan.resetEnd < plan.fadeInAt);
  near(plan.resetEnd - plan.resetAt, simpleReset.resetPulse);
  near(plan.resetEnd + plan.replayWait, plan.period);
  assert.equal(planSimpleReset(null), null);
});

test('desktop/mobile reset follows the real ending and recurs inside the same hidden interval', () => {
  const mobile = planSimpleReset({ ...ending, appearsAt: 65.081923 });
  near(plan.period - mobile.period, ending.appearsAt - 65.081923);
  for (const p of [plan, mobile]) for (const cycle of [0, 1, 2]) {
    const offset = cycle * p.period;
    assert.ok(p.resetAt + offset > p.hiddenAt + offset);
    assert.ok(p.resetEnd + offset < p.fadeInAt + offset);
    near(p.resetEnd + offset + p.replayWait, (cycle + 1) * p.period);
  }
});

test('one unchanged scene, one native opacity envelope and complete replay delay adapter, no geometry or scripts', () => {
  const original = '<g class="original-scene">unchanged original content</g>';
  const markup = wrapSimpleReset(original, plan, [{ id: 'motion-1', startAt: 17.6 }],
    { after: n => n - 4.0846, starsAt: 3.5154 }, { startAt: 13.3154 });
  assert.equal(markup.split(original).length - 1, 1);
  assert.equal((markup.match(/<animate /g) || []).length, 1);
  assert.equal((markup.match(/<set /g) || []).length, 2);
  assert.match(markup, /attributeName="opacity" values="1;0;0;1"/);
  const syncbaseIds = [...markup.matchAll(/;([^;"\s]+)\.end\+/g)].map(m => m[1]);
  assert.equal(syncbaseIds.length, 2);
  for (const id of syncbaseIds) {
    // Unescaped hyphens lose later syncbase intervals in Firefox's SMIL parser.
    assert.match(id, /^[A-Za-z_][A-Za-z0-9_]*$/);
    assert.ok(markup.includes(`id="${id}"`));
  }
  for (const selector of ['.ship-entry', '.ship-engine-trail', '.space', '.projectile', '.hit-explosion', '.target-life', '.invader-victory', '[data-motion="motion-1"]']) {
    assert.ok(markup.includes('.invader-replay ' + selector), selector);
  }
  assert.doesNotMatch(markup, /<rect|<path|<filter|<mask|<script|foreignObject|reset-tile|cascade|jitter/);
  assert.equal(wrapSimpleReset(original, null), original);
});
