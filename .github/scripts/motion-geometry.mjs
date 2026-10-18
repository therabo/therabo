// Full-Length Horde with an intentional right margin. Adaptive mathematics is unchanged.
export const canvas = Object.freeze({ left: -16, right: 864, top: -32, bottom: 160, width: 880, height: 192 });
const reservedLeftFraction = .15;
const rightMargin = 22;
export const horizontalGuard = .6; // Collision/stroke safety, not a layout margin.
export const invaderGeometry = Object.freeze({ size: 12, strokeWidth: 1, verticalAnchorInset: 6 });
export const invaderVerticalMotion = Object.freeze({ maximum: 5, guard: .6, safety: .995 });
export const region = Object.freeze({ left: canvas.left + canvas.width * reservedLeftFraction, right: canvas.right - rightMargin, top: canvas.top + 6 * .75, bottom: canvas.bottom - 6 * .75, deployAt: 13, deployDuration: 4.4 });
const round = n => Number(n.toFixed(6));
const distance = (a, b) => Math.hypot(a.x-b.x,a.y-b.y);
export function motionCaps(anchors, scale) {
  const size = invaderGeometry.size * scale;
  const caps = anchors.map(p => ({
    x: Math.max(0, Math.min(27 * scale, p.x - region.left, region.right - p.x - size) - .6 * scale),
    y: Math.max(0, Math.min(invaderVerticalMotion.maximum * scale, p.y - region.top, region.bottom - p.y - size) - invaderVerticalMotion.guard * scale),
  }));
  const pairs = [];
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) pairs.push([i, j, distance(anchors[i], anchors[j])]);
  pairs.sort((a, b) => a[2] - b[2]);
  // Shrinking envelopes is monotonic: resolving a pair cannot break an earlier pair.
  for (const [i, j] of pairs) {
    const dx = Math.abs(anchors[i].x - anchors[j].x) - size - 1.1 * scale, dy = Math.abs(anchors[i].y - anchors[j].y) - size - 1.1 * scale;
    if (dx >= caps[i].x + caps[j].x || dy >= caps[i].y + caps[j].y) continue;
    const axis = dx / (caps[i].x + caps[j].x) >= dy / (caps[i].y + caps[j].y) ? 'x' : 'y', gap = axis === 'x' ? dx : dy;
    if (gap <= 0) return null;
    const factor = gap / (caps[i][axis] + caps[j][axis]); caps[i][axis] *= factor; caps[j][axis] *= factor;
  }
  return caps.map(c => ({ x: round(c.x * .995), y: round(c.y * invaderVerticalMotion.safety) }));
}

export function motionEnvelopes(anchors, scale = 1, approved = motionCaps(anchors, scale)) {
  if (!approved || approved.length !== anchors.length) throw new Error('Invalid motion-envelope geometry');
  const size = invaderGeometry.size * scale, guard = .6 * scale, separation = 1.1 * scale;
  const verticalGuard = invaderVerticalMotion.guard * scale;
  const envelopes = anchors.map((a, i) => {
    const geometricLeft = a.x - region.left, geometricRight = region.right - a.x - size;
    const geometricUp = a.y - region.top, geometricDown = region.bottom - a.y - size;
    if (Math.min(geometricLeft, geometricRight, geometricUp, geometricDown) < 0) throw new Error('Motion anchor outside bounds');
    const horizontal = room => Math.max(0, Math.min(27 * scale, room) - guard);
    return {
      geometricLeft, geometricRight, geometricUp, geometricDown,
      availableLeft: horizontal(geometricLeft), availableRight: horizontal(geometricRight),
      // These independent geometric checks retain the current vertical motion exactly.
      availableUp: Math.min(approved[i].y, Math.max(0, geometricUp - verticalGuard)),
      availableDown: Math.min(approved[i].y, Math.max(0, geometricDown - verticalGuard)),
    };
  });
  const unconstrained = envelopes.map(e => ({ left: e.availableLeft, right: e.availableRight }));
  const pairs = [];
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) pairs.push([i, j, Math.hypot(anchors[i].x - anchors[j].x, anchors[i].y - anchors[j].y)]);
  pairs.sort((a, b) => a[2] - b[2]);
  for (const [i, j] of pairs) {
    const a = anchors[i], b = anchors[j], ea = envelopes[i], eb = envelopes[j];
    const dy = Math.abs(a.y - b.y) - size - separation;
    const vertical = a.y <= b.y ? ea.availableDown + eb.availableUp : ea.availableUp + eb.availableDown;
    if (dy >= vertical) continue;
    const sideA = a.x <= b.x ? 'availableRight' : 'availableLeft';
    const sideB = a.x <= b.x ? 'availableLeft' : 'availableRight';
    const gap = Math.abs(a.x - b.x) - size - separation, combined = ea[sideA] + eb[sideB];
    if (gap < 0) throw new Error('No collision-safe horizontal envelope');
    if (combined > gap) {
      const factor = gap / combined;
      ea[sideA] *= factor; eb[sideB] *= factor;
    }
  }
  return envelopes.map((e, i) => ({
    ...e,
    availableLeft: round(e.availableLeft * .995), availableRight: round(e.availableRight * .995),
    availableUp: round(e.availableUp), availableDown: round(e.availableDown),
    rightBoundConstrained: e.geometricRight - guard < 27 * scale,
    rightNeighbourConstrained: e.availableRight < unconstrained[i].right - 1e-6,
    leftBoundConstrained: e.geometricLeft - guard < 27 * scale,
    leftNeighbourConstrained: e.availableLeft < unconstrained[i].left - 1e-6,
  }));
}

// Global maximum visual reach at the approved extreme anchors, including the
// actual motion envelopes and half of the sprite stroke. Independent of a
// particular dataset's occupancy and of local travel around a single anchor.
export function hordeVerticalRange() {
  const { size, strokeWidth, verticalAnchorInset } = invaderGeometry;
  const x = (region.left + region.right - size) / 2;
  const anchors = [{ x, y: region.top + verticalAnchorInset }, { x, y: region.bottom - size - verticalAnchorInset }];
  const envelopes = motionEnvelopes(anchors, 1);
  return { top: round(anchors[0].y - envelopes[0].availableUp - strokeWidth / 2), bottom: round(anchors[1].y + size + envelopes[1].availableDown + strokeWidth / 2) };
}


export function intervalOverlap(a0, a1, b0, b1, margin) {
  let lo = 0, hi = 1;
  const inequalities = [
    [a0.x - b0.x - b0.size - margin, a1.x - b1.x - b1.size - margin],
    [b0.x - a0.x - a0.size - margin, b1.x - a1.x - a1.size - margin],
    [a0.y - b0.y - b0.size - margin, a1.y - b1.y - b1.size - margin],
    [b0.y - a0.y - a0.size - margin, b1.y - a1.y - a1.size - margin],
  ];
  for (const [v0, v1] of inequalities) {
    const d = v1 - v0;
    if (Math.abs(d) < 1e-10) { if (v0 >= 0) return false; }
    else if (d > 0) hi = Math.min(hi, -v0 / d);
    else lo = Math.max(lo, -v0 / d);
    if (hi <= lo + 1e-8) return false;
  }
  return hi > Math.max(0, lo) + 1e-8 && lo < 1;
}
