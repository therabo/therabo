import test from 'node:test';
import assert from 'node:assert/strict';
import { ship, shipEngines, shipTrail, shipTrailCurve, shipSafeVerticalRange, shipPoseAt, shipMarkup } from '../.github/scripts/ship.mjs';
import { canvas } from '../.github/scripts/motion-geometry.mjs';

test('three smooth engine trails: geometry, hierarchy, attachment and clipping only', () => {
  assert.equal(shipTrail.length, 3);
  assert.deepEqual(shipEngines.map(e => [e.id, e.u, e.v, e.x, e.y]), [
    ['upper', 3.5, 18, -12.75, -4.5], ['center', 6.5, 19, -14.25, 0], ['lower', 9.5, 18, -12.75, 4.5],
  ]);
  const main = shipTrail.find(e => e.id === 'center'), sides = shipTrail.filter(e => e.id !== 'center');
  for (const side of sides) {
    assert.ok(side.length / main.length >= .65 && side.length / main.length <= .8);
    assert.ok(side.strokeWidth / main.strokeWidth >= .55 && side.strokeWidth / main.strokeWidth <= .75);
  }
  assert.equal(sides[0].x, sides[1].x); assert.equal(sides[0].y, -sides[1].y);
  assert.equal(sides[0].length, sides[1].length); assert.equal(sides[0].strokeWidth, sides[1].strokeWidth);
  const markup = shipMarkup();
  assert.equal((markup.match(/class="ship-engine-trail /g) || []).length, 3);
  assert.equal((markup.match(/stroke-linecap="round"/g) || []).length, 3);
  assert.equal((markup.match(/<linearGradient /g) || []).length, 3);
  assert.doesNotMatch(markup, /<rect|ship-wake-point/);
  const poseAt = time => shipPoseAt(time);
  for (const time of [13.2, 14, 14.9, 15.4, 17.4, ...Array.from({ length: 257 }, (_, i) => 17.4 + i / 16)]) {
    const pose = poseAt(time), angle = pose.angle * Math.PI / 180;
    for (const engine of shipTrail) {
      const curve = shipTrailCurve(engine, time);
      assert.deepEqual(curve.start, { x: engine.x, y: engine.y });
      assert.equal(curve.c1.y, engine.y, 'Nozzle tangent follows the ship axis');
      assert.match(curve.d, /^M [-.\d]+ [-.\d]+ C /);
      // Bezier convex hull encloses the entire smooth path, with its round stroke.
      if (time >= 15.4) for (const point of [curve.start, curve.c1, curve.c2, curve.end]) {
        const x = pose.x + point.x * Math.cos(angle) - point.y * Math.sin(angle), y = pose.y + point.x * Math.sin(angle) + point.y * Math.cos(angle), r = engine.strokeWidth / 2;
        assert.ok(x - r >= canvas.left && x + r <= canvas.right && y - r >= canvas.top && y + r <= canvas.bottom, 'No clipping after entering the left edge');
        if (time >= (ship.enterAt + ship.duration)) assert.ok(y - r >= shipSafeVerticalRange.invaders.top && y + r <= shipSafeVerticalRange.invaders.bottom);
      }
    }
  }
  for (const engine of shipTrail) assert.equal(shipTrailCurve(engine, 26.82).d, shipTrailCurve(engine, 34.82).d, 'No autonomous motion without targets');
});
