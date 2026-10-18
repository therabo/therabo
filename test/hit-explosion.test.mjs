import test from 'node:test';
import assert from 'node:assert/strict';
import { explosion, explosionFreezeIterations, explosionMarkup, explosionStyles } from '../.github/scripts/hit-explosion.mjs';
import { planGameplay, gameplayStateAt } from '../.github/scripts/gameplay.mjs';
import { smallGameplayPlans } from './fixtures/gameplay-small.mjs';

const timeline = planGameplay(smallGameplayPlans);
test('hit lifecycle: locked → exploding → destroyed without a second selection', () => {
  const s = timeline.shots[0];
  assert.ok(gameplayStateAt(timeline, s.hitAt - .000001).locked.includes(s.target));
  assert.ok(gameplayStateAt(timeline, s.hitAt).exploding.includes(s.target));
  assert.ok(!gameplayStateAt(timeline, s.hitAt).available.includes(s.target));
  assert.ok(!gameplayStateAt(timeline, s.hitAt).locked.includes(s.target));
  assert.ok(gameplayStateAt(timeline, s.destroyedAt - .000001).exploding.includes(s.target));
  assert.ok(gameplayStateAt(timeline, s.destroyedAt).destroyed.includes(s.target));
  assert.ok(Math.abs(s.destroyedAt - s.hitAt - explosion.duration) < 1e-12);
  assert.equal(new Set(timeline.shots.map(s => s.target)).size, timeline.shots.length);
  assert.equal(gameplayStateAt(timeline, timeline.completeAt).destroyed.length, 4);
});

test('projectile ends on impact, ship selects next immediately, independently of burst', () => {
  const s = timeline.shots[0], state = gameplayStateAt(timeline, s.hitAt);
  assert.ok(!state.bullets.some(b => b.target === s.target));
  assert.equal(timeline.moves[1].startAt, s.fireAt);
  assert.ok(timeline.moves[1].startAt < s.hitAt && timeline.moves[1].startAt < s.destroyedAt);
  assert.ok(state.bullets.length > 0);
});

test('three overlapping bursts have independent lifecycle, position and animation delay', () => {
  const shots = timeline.shots.slice(0, 3).map((s, i) => ({ ...s, fireAt: .1 + i * .1, hitAt: 1 + i * .08, destroyedAt: 1 + i * .08 + explosion.duration }));
  const fixture = { ...timeline, shots };
  assert.equal(gameplayStateAt(fixture, 1.2).exploding.length, 3);
  const markup = explosionMarkup(fixture, smallGameplayPlans);
  assert.equal((markup.match(/class="hit-explosion"/g) || []).length, 3);
  for (const s of shots) assert.ok(markup.includes(`--hit-at:${s.hitAt}s`));
  assert.doesNotMatch(markup, /<filter|blur|gradient|<script/);
  assert.match(explosionStyles(), /arcade-static-burst/);
});

test('freeze uses the real animation clock, also before normal movement begins', () => {
  for (let i = 0; i < timeline.shots.length; i++) {
    const s = timeline.shots[i], p = smallGameplayPlans.find(p => p.date === s.target);
    const count = explosionFreezeIterations(p, s);
    assert.ok(Math.abs(p.startAt + count * p.period - s.hitAt) < 1e-10);
  }
  assert.equal(explosionFreezeIterations({ startAt: 25, period: 30 }, { hitAt: 20 }), 0);
  assert.ok(explosion.duration >= .3 && explosion.duration <= .45);
  assert.equal(explosion.peakDiameter / 12, 1.8);
});
