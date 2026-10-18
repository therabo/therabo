import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planGameplay, gameplay, gameplayStateAt, invaderPositionAt, selectLeftmost } from '../.github/scripts/gameplay.mjs';
import { smallGameplayPlans } from './fixtures/gameplay-small.mjs';
import { ship, shipPoseAt, shipSafeVerticalRange, shipStyles, shipMarkup, shipTrail, shipTrailCurve } from '../.github/scripts/ship.mjs';
import { planHorde, hordeStyles, horde } from '../.github/scripts/horde.mjs';
import { invaderMorphTiming, invaderPositioningTiming, shiftGameplayTimeline } from '../.github/scripts/invader-timing.mjs';
import { createDeployment } from '../.github/scripts/organic-deployment.mjs';
import { contributionInvaders, layoutCalendar } from '../.github/scripts/invaders.mjs';

function verify(plans, timeline, concurrent = true) {
  const remaining = [...plans];
  assert.equal(timeline.shots.length, plans.length);
  assert.equal(new Set(timeline.shots.map(s => s.target)).size, plans.length);
  assert.equal(timeline.startAt, 17.4);
  for (const [i, shot] of timeline.shots.entries()) {
    const target = remaining.find(p => p.date === shot.target), chosen = selectLeftmost(remaining, shot.selectedAt);
    assert.equal(target.date, chosen.date, 'Choose the current minimum x among AVAILABLE');
    remaining.splice(remaining.indexOf(target), 1);
    assert.ok(shot.fireAt >= 17.4 && shot.hitAt > shot.fireAt);
    assert.ok(shot.alignmentError <= shot.alignmentTolerance, 'Aligned within guarded sprite cross-section');
    const hit = invaderPositionAt(target, shot.hitAt), half = 6 * target.scale;
    assert.ok(Math.abs(shot.impact.x - hit.x - half) < 1e-7, 'Predicted x hits the assigned moving target');
    assert.ok(Math.abs(shot.impact.y - hit.y - half) <= shot.alignmentTolerance, 'Predicted y stays inside the target');
    assert.equal(shot.origin.y, shot.impact.y, 'Horizontal trajectory');
    assert.equal(shot.speed, 200);
    assert.ok(Math.abs(shot.impact.x - shot.origin.x - shot.speed * (shot.hitAt - shot.fireAt)) < 1e-7);
    assert.equal(shot.origin.x, ship.finalX + ship.width / 2);
    assert.ok(gameplayStateAt(timeline, shot.fireAt).locked.includes(shot.target), 'LOCKED immediately at fire');
    assert.ok(gameplayStateAt(timeline, shot.hitAt).exploding.includes(shot.target), 'EXPLODING at impact');
    assert.ok(gameplayStateAt(timeline, shot.destroyedAt).destroyed.includes(shot.target), 'DESTROYED after burst');
    if (i < timeline.shots.length - 1) assert.equal(timeline.moves[i + 1].startAt, shot.fireAt, 'Select and move immediately after fire, before impact');
    const m = timeline.moves[i];
    const a = shipPoseAt(m.startAt, timeline), b = shipPoseAt(m.endAt, timeline);
    assert.equal(a.y, m.fromY); assert.ok(Math.abs(b.y - m.toY) < 1e-8);
    assert.equal(a.x, 50); assert.equal(b.x, 50);
    assert.ok(Math.abs(shipPoseAt(m.startAt + .00001, timeline).y - a.y) < 1e-8, 'Zero velocity at manoeuvre boundary');
  }
  if (concurrent) assert.ok(timeline.maxConcurrent >= 2);
  assert.ok(timeline.shots.some((s, i) => i < timeline.shots.length - 1 && shipPoseAt(s.fireAt + .15, timeline).y !== s.origin.y && s.fireAt + .15 < s.hitAt), 'Ship changes y while a previous bullet is in flight');
  const done = gameplayStateAt(timeline, timeline.completeAt);
  assert.equal(done.available.length, 0); assert.equal(done.locked.length, 0); assert.equal(done.destroyed.length, plans.length);
  assert.deepEqual(shipPoseAt(timeline.completeAt, timeline), shipPoseAt(timeline.completeAt + 100, timeline), 'Hold after final shot');
  for (let t = 17.4; t < timeline.completeAt + .3; t += .04) {
    const pose = shipPoseAt(t, timeline);
    assert.ok(pose.y >= shipSafeVerticalRange.top && pose.y <= shipSafeVerticalRange.bottom);
    for (const engine of shipTrail) {
      const curve = shipTrailCurve(engine, t, timeline);
      assert.deepEqual(curve.start, { x: engine.x, y: engine.y });
      for (const p of [curve.start, curve.c1, curve.c2, curve.end]) {
        const y = pose.y + p.y, r = engine.strokeWidth / 2;
        assert.ok(y - r >= shipSafeVerticalRange.invaders.top && y + r <= shipSafeVerticalRange.invaders.bottom, 'Entire cubic/stroke stays in safe corridor');
      }
    }
  }
}

test('small fixture: x order, locking, independent horizontal shots, concurrent flight and stop', () => {
  const timeline = planGameplay(smallGameplayPlans);
  verify(smallGameplayPlans, timeline);
  assert.deepEqual(timeline.shots.map(s => s.selectedX), [200, 250, 300, 400]);
  assert.ok(Math.abs(126 - 64) > Math.abs(62 - 64), 'First target is deliberately farther vertically');
  const tie = smallGameplayPlans.slice(0, 2).map(p => ({ ...p, finalX: 200 }));
  assert.equal(selectLeftmost(tie.reverse(), 20).date, '2026-01-01', 'ISO date is stable tie-break');
  assert.equal(planGameplay([]).shots.length, 0);
});

test('real 39: preserved horde, current-x selection, moving intercepts, trails and SVG integration', async () => {
  const calendar = JSON.parse(await readFile(new URL('../assets/contributions/calendar.json', import.meta.url)));
  const configuration = createDeployment(layoutCalendar(calendar), { seed: '0375e116b1f14dcf318f471fb442383a' });
  const before = structuredClone(configuration), plans = planHorde(layoutCalendar(calendar), false, configuration), timeline = planGameplay(plans);
  verify(plans, timeline);
  assert.equal(plans.length, 39); assert.ok(timeline.maxConcurrent >= 2, 'Concurrent projectiles remain supported');
  assert.deepEqual(configuration, before);
  assert.deepEqual(plans, planHorde(layoutCalendar(calendar), false, configuration));
  const rendered = contributionInvaders(calendar, 'dark', false, false, configuration);
  assert.equal((rendered.match(/class="projectile"/g) || []).length, 39);
  assert.equal((rendered.match(/class="target-life"/g) || []).length, 39);
  assert.equal((rendered.match(/class="ship-engine-trail /g) || []).length, 3);
  const timing = invaderMorphTiming(layoutCalendar(calendar), configuration);
  const positioning = invaderPositioningTiming(timing);
  assert.ok(rendered.includes(hordeStyles(plans, positioning.new.deployment.start, positioning.new.deployment.duration)));
  const shifted = shiftGameplayTimeline(timeline, positioning.timelineOffset);
  const movedPlans = plans.map(p => ({ ...p, startAt: p.startAt - positioning.timelineOffset }));
  const remaining = [...movedPlans];
  assert.equal(shifted.shots.length, 39);
  for (const [i, shot] of shifted.shots.entries()) {
    const target = remaining.find(p => p.date === shot.target);
    assert.equal(selectLeftmost(remaining, shot.selectedAt).date, shot.target);
    remaining.splice(remaining.indexOf(target), 1);
    const hit = invaderPositionAt(target, shot.hitAt);
    assert.ok(Math.abs(shot.impact.x - hit.x - 6) < 1e-7);
    assert.ok(Math.abs(shot.impact.y - hit.y - 6) <= shot.alignmentTolerance);
    assert.equal(shot.speed, 200);
    assert.ok(Math.abs((shot.hitAt - shot.fireAt) - (timeline.shots[i].hitAt - timeline.shots[i].fireAt)) < 1e-12);
    assert.deepEqual(shot.origin, timeline.shots[i].origin);
    assert.deepEqual(shot.impact, timeline.shots[i].impact);
  }
  assert.equal(remaining.length, 0);
  assert.doesNotMatch(rendered, /ship-idle|sinusoidal|sine wave|<script|foreignObject|NaN|undefined/);
  assert.doesNotMatch(shipStyles(timeline), /ship-idle|infinite/);
  assert.equal((shipMarkup().match(/stroke-linecap="round"/g) || []).length, 3);
  for (const theme of ['dark', 'light']) for (const mobile of [false, true]) {
    const svg = contributionInvaders(calendar, theme, mobile, false, configuration);
    assert.match(svg, /arcade-static-burst/);
    assert.match(svg, /\.projectiles\{display:none!important\}/);
    assert.doesNotMatch(contributionInvaders(calendar, theme, mobile, true), /projectile|ship-entry|target-life/);
  }
  // Extreme geometry: use the approved maximum centres, not the old sine travel.
  const extremes = smallGameplayPlans.slice(0, 2).map((p, i) => ({ ...p, finalY: i ? 141.878 : -19.878 }));
  verify(extremes, planGameplay(extremes), false);
  console.log(`real 39: 39 hits; maximum ${timeline.maxConcurrent} bullets; completion ${timeline.completeAt.toFixed(3)} s; maximum alignment error ${Math.max(...timeline.shots.map(s => s.alignmentError)).toFixed(3)} px`);
});
