import test from 'node:test';
import assert from 'node:assert/strict';
import { invaderMorphTiming, invaderPositioningTiming } from '../.github/scripts/invader-timing.mjs';
import { sequence } from '../.github/scripts/contribution-scene.mjs';
import { horde } from '../.github/scripts/horde.mjs';
import { ship } from '../.github/scripts/ship.mjs';

const cells = [
  { date: '2025-11-05', week: 3, count: 11 },
  { date: '2026-10-17', week: 52, count: 1 },
];
const configuration = { seed: 'morph-clock', selectedDates: cells.map(c => c.date) };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test('halve the actual staggered block interval and every local progress, preserve downstream gaps', () => {
  const timing = invaderMorphTiming(cells, configuration);
  assert.deepEqual(timing.old, { start: 2.6308, end: 10.8, duration: 8.1692 });
  assert.deepEqual(timing.new, { start: 2.6308, end: 6.7154, duration: 4.0846 });
  assert.equal(timing.timeSaved, 4.0846);
  assert.equal(timing.cellDuration, sequence.morph / 2);
  for (const c of cells) for (const p of [0, .25, .5, .75, 1]) {
    near(timing.morphTime(timing.oldDelay(c) + sequence.morph * p), timing.delay(c) + timing.cellDuration * p);
  }
  near(timing.after(horde.settleAt) - timing.new.end, horde.settleAt - timing.old.end);
  near(timing.after(ship.enterAt) - timing.new.end, ship.enterAt - timing.old.end);
  near(timing.after(ship.enterAt + ship.duration) - timing.after(ship.enterAt), ship.duration);
  near(timing.starsAt, timing.morphTime(sequence.starsAt));
  near(timing.starsAt + timing.starsFade, timing.morphTime(sequence.starsAt + sequence.starsFade));
});

test('representative mode includes omitted blocks in the true transformation interval; empty mode has none', () => {
  const omitted = invaderMorphTiming(cells, { ...configuration, selectedDates: [cells[0].date] });
  const end = omitted.oldRetire(cells[1]) + sequence.morph;
  near(omitted.old.end, end);
  assert.ok(omitted.old.end > 10.8, 'Last omitted fade completes after the selected sprite morph');
  near(omitted.retire(cells[1]) + omitted.cellDuration, omitted.new.end);
  const legacy = invaderMorphTiming(cells, { seed: configuration.seed });
  assert.deepEqual(legacy.old, invaderMorphTiming(cells, configuration).old);
  assert.throws(() => invaderMorphTiming([], configuration), /no block-to-invader morph/);
});

test('positioning alone is 1.60×, including the entry offset, with simultaneous completion and no gameplay gap', () => {
  const morph = invaderMorphTiming(cells, configuration), clock = invaderPositioningTiming(morph);
  assert.deepEqual(clock.old, {
    deployment: { start: 8.9154, end: 13.3154, duration: 4.4 },
    ship: { start: 9.1154, end: 13.3154, duration: 4.2 }, offset: .2, gameplayAt: 13.3154,
  });
  assert.deepEqual(clock.new, {
    deployment: { start: 7.5954, end: 10.3454, duration: 2.75 },
    ship: { start: 7.7204, end: 10.3454, duration: 2.625 }, offset: .125, gameplayAt: 10.3454,
  });
  near(clock.timeSaved, 1.65);
  near(clock.timelineOffset, morph.timeSaved + 1.65 + 1.32);
  assert.equal(clock.speedMultiplier, 1.60);
  for (const progress of [0, .25, .5, .75, 1]) {
    near(clock.after(horde.settleAt + progress * horde.settleDuration), clock.new.deployment.start + progress * clock.new.deployment.duration);
    near(clock.after(ship.enterAt + progress * ship.duration), clock.new.ship.start + progress * clock.new.ship.duration);
  }
});

test('morph/star timing and post-entry gameplay/motion time intervals stay unchanged', () => {
  const morph = invaderMorphTiming(cells, configuration), clock = invaderPositioningTiming(morph);
  for (const time of [morph.old.start, morph.old.end - .01, morph.old.end]) near(clock.after(time), morph.after(time));
  near(morph.starsAt, 3.5154); near(morph.starsAt + morph.starsFade, 7.1154);
  const end = ship.enterAt + ship.duration;
  for (const elapsed of [0, .2, 1.8, 8, 25, 60]) {
    near(clock.after(end + elapsed) - clock.new.gameplayAt, elapsed);
    near(morph.after(end + elapsed) - clock.after(end + elapsed), 1.65 + 1.32);
  }
  assert.equal(horde.settleDuration, 4.4, 'Shared geometry/planner clock remains canonical');
  near(ship.duration, 4.2);
});

test('retain 40% of the actual pre-positioning gap without touching the starfield or positioning speed', () => {
  for (const selection of [configuration, { ...configuration, selectedDates: [cells[0].date] }]) {
    const morph = invaderMorphTiming(cells, selection), clock = invaderPositioningTiming(morph);
    const originalGap = morph.after(horde.settleAt) - morph.new.end;
    near(clock.gap.oldDuration, originalGap);
    near(clock.gap.newDuration, originalGap * .4);
    near(clock.gap.timeSaved, originalGap * .6);
    near(clock.new.deployment.start - morph.new.end, clock.gap.newDuration);
    near(clock.new.ship.start - clock.new.deployment.start, .125);
    near(clock.new.ship.end, clock.new.deployment.end);
    near(clock.new.gameplayAt, clock.new.ship.end);
  }
  const morph = invaderMorphTiming(cells, configuration), clock = invaderPositioningTiming(morph);
  assert.deepEqual(clock.gap, { oldDuration: 2.2, newDuration: .88, retainedFraction: .4, timeSaved: 1.32 });
  near(clock.new.deployment.start - (morph.starsAt + morph.starsFade), .48);
});
