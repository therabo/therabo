import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDeployment, validateDeployment, validatePaths } from '../.github/scripts/organic-deployment.mjs';
import { canvas, region, motionEnvelopes } from '../.github/scripts/motion-geometry.mjs';
import { layoutCalendar } from '../.github/scripts/contribution-scene.mjs';
import { planHorde } from '../.github/scripts/horde.mjs';
import { selectRepresentative, validateSampling, qualityGuard } from '../.github/scripts/horde-selection.mjs';
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url)));

function certify(calendar, deployment) {
  const selected = layoutCalendar(calendar).filter(c => deployment.selectedDates.includes(c.date));
  assert.equal(deployment.scale, 1);
  assert.ok(validateDeployment(selected, deployment).valid);
  assert.deepEqual(validatePaths(selected, deployment), []);
  assert.ok(qualityGuard(deployment.anchors, deployment.caps, { representative: deployment.densityMode === 'representative' }).valid);
  const envelopes = motionEnvelopes(deployment.anchors, 1, deployment.caps);
  const boxes = deployment.anchors.map((p, i) => ({
    left: p.x - envelopes[i].availableLeft - .5, right: p.x + 12 + envelopes[i].availableRight + .5,
    top: p.y - envelopes[i].availableUp - .5, bottom: p.y + 12 + envelopes[i].availableDown + .5,
  }));
  for (const box of boxes) assert.ok(box.left >= region.left && box.right <= region.right && box.top >= region.top && box.bottom <= region.bottom);
  for (let i = 0; i < boxes.length; i++) for (const b of boxes.slice(i + 1)) {
    const a = boxes[i]; assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  }
  const wide = planHorde(layoutCalendar(calendar), false, deployment), mobile = planHorde(layoutCalendar(calendar), true, deployment);
  for (const [i, p] of wide.entries()) {
    assert.equal(p.period, mobile[i].period); assert.equal(p.startAt, mobile[i].startAt);
    assert.deepEqual(p.deployment, mobile[i].deployment);
    assert.equal(p.points[0].x, p.points.at(-1).x); assert.equal(p.points[0].y, p.points.at(-1).y);
  }
}

test('fixed-size bounds reserve 15%, preserve the 22-unit margin and independent outward motion', () => {
  assert.equal(region.left, canvas.left + canvas.width * .15);
  assert.deepEqual([region.left, region.right, region.top, region.bottom], [116, 842, -27.5, 155.5]);
  assert.equal(canvas.right - region.right, 22);
  const clear = motionEnvelopes([{ x: 800, y: 40 }])[0];
  const pair = motionEnvelopes([{ x: 780, y: 40 }, { x: 800, y: 40 }]);
  assert.ok(clear.availableRight > 25);
  assert.ok(pair[1].availableRight > pair[1].availableLeft * 5);
  assert.equal(motionEnvelopes([{ x: region.right - 12 - .6, y: 40 }])[0].availableRight, 0);
});

test('real 39 and outlier 120 retain certified full-set incumbents; invalid geometry is rejected', async () => {
  for (const [file, seed, count] of [
    ['../assets/contributions/calendar.json', '0375e116b1f14dcf318f471fb442383a', 39],
    ['./fixtures/outliers-calendar.json', 'e15defb57881ea205b29b181f5c92522', 120],
  ]) {
    const calendar = await json(file), d = createDeployment(layoutCalendar(calendar), { seed });
    assert.equal(d.displayedInvaders, count); assert.equal(d.thinningDisabled, true); certify(calendar, d);
    const bad = structuredClone(d); bad.anchors[0].x = 0;
    assert.equal(validateDeployment(layoutCalendar(calendar).filter(c => c.count), bad).valid, false);
  }
});

test('dense 370 revalidates and preserves the approved 144-sprite readable reference', async () => {
  const calendar = await json('./fixtures/dense-calendar.json'), reference = await json('./fixtures/dense-layout.json');
  const d = createDeployment(layoutCalendar(calendar), { seed: reference.seed, referenceDeployment: reference });
  assert.equal(d.totalActiveDays, 370); assert.equal(d.displayedInvaders, 144); assert.equal(d.referenceRetained, true);
  assert.deepEqual(d.anchors, reference.anchors); assert.deepEqual(d.paths, reference.paths); certify(calendar, d);
});

test('sampling is reproducible and retains rare contribution levels, clusters and outliers', async () => {
  const cells = layoutCalendar(await json('./fixtures/dense-calendar.json')).map((c, i) => ({ ...c, level: i === 170 ? 1 : 4 }));
  for (const seed of ['sample-a', 'sample-b', 'sample-c']) {
    const selected = selectRepresentative(cells, 100, seed);
    assert.ok(selected.cells.some(c => c.level === 1)); assert.ok(validateSampling(selected.metrics).valid);
    assert.deepEqual(selected, selectRepresentative(cells, 100, seed));
  }
});
