import { projectileShape, projectileVisual } from './space-visuals.mjs';
import { explosion } from './hit-explosion.mjs';
import { invaderGeometry } from './motion-geometry.mjs';
import { ship, shipSafeVerticalRange } from './ship.mjs';

// Compile once at generation time: the exported SVG needs no runtime scripts.
export const gameplay = Object.freeze({
  startAt: ship.enterAt + ship.duration,
  shipMaxSpeed: 75,
  minimumMoveDuration: .35,
  projectileSpeed: 200,
  projectileLength: 5, // Approved logical dimensions; artwork is independent.
  projectileWidth: .9,
  alignmentGuard: 1,
});
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cubic = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;

// Invert CSS's cubic-bezier time coordinate, then evaluate its value coordinate.
// This reads the existing horde keyframes, including their per-segment easing.
export function invaderPositionAt(plan, time) {
  const phase = time <= plan.startAt ? 0 : ((time - plan.startAt) % plan.period) / plan.period * 100;
  const index = Math.max(0, plan.points.findIndex((p, i) => i < plan.points.length - 1 && phase < plan.points[i + 1].percent));
  const a = plan.points[index], b = plan.points[index + 1];
  const progress = clamp((phase - a.percent) / (b.percent - a.percent), 0, 1);
  let lo = 0, hi = 1;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (cubic(mid, a.ease[0], a.ease[2]) < progress) lo = mid; else hi = mid;
  }
  const gain = cubic((lo + hi) / 2, a.ease[1], a.ease[3]);
  return { x: plan.finalX + a.x + (b.x - a.x) * gain, y: plan.finalY + a.y + (b.y - a.y) * gain };
}

export function selectLeftmost(plans, time) {
  // Exact current x is always primary; ISO date is the stable tie-break.
  return [...plans].sort((a, b) => invaderPositionAt(a, time).x - invaderPositionAt(b, time).x || a.date.localeCompare(b.date))[0];
}

function interceptAt(target, fireAt, originX) {
  const half = invaderGeometry.size * target.scale / 2;
  const distance = time => invaderPositionAt(target, time).x + half - originX - gameplay.projectileSpeed * (time - fireAt);
  let lo = fireAt, hi = fireAt + 1;
  while (distance(hi) > 0) hi += 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (distance(mid) > 0) lo = mid; else hi = mid;
  }
  const time = (lo + hi) / 2, p = invaderPositionAt(target, time);
  return { time, x: p.x + half, y: p.y + half };
}

export function planGameplay(plans) {
  const available = [...plans], moves = [], shots = [];
  let time = gameplay.startAt, y = ship.finalY;
  const originX = ship.finalX + ship.width / 2;
  while (available.length) {
    const target = selectLeftmost(available, time);
    const half = invaderGeometry.size * target.scale / 2;
    const tolerance = half - gameplay.projectileWidth / 2 - gameplay.alignmentGuard;
    let duration = gameplay.minimumMoveDuration, intercept, aimY;
    // Fixed-point solve: arrival depends on predicted impact altitude and impact
    // time depends on arrival. The target's slow motion makes this contractive.
    for (let i = 0; i < 40; i++) {
      intercept = interceptAt(target, time + duration, originX);
      aimY = clamp(intercept.y, shipSafeVerticalRange.top, shipSafeVerticalRange.bottom);
      duration = Math.max(gameplay.minimumMoveDuration, 1.875 * Math.abs(aimY - y) / gameplay.shipMaxSpeed);
    }
    // Keep the firing row within the current sprite as well as the predicted
    // sprite. Extend the manoeuvre if the target crosses a motion turning point.
    let aligned = false;
    for (let i = 0; i < 2400; i++) {
      intercept = interceptAt(target, time + duration, originX);
      aimY = clamp(intercept.y, shipSafeVerticalRange.top, shipSafeVerticalRange.bottom);
      const required = Math.max(gameplay.minimumMoveDuration, 1.875 * Math.abs(aimY - y) / gameplay.shipMaxSpeed);
      if (duration + 1e-8 >= required && Math.abs(aimY - invaderPositionAt(target, time + duration).y - half) <= tolerance) { aligned = true; break; }
      duration = Math.max(required, duration + .025);
    }
    if (!aligned || Math.abs(aimY - intercept.y) > tolerance) throw new Error(`No safe horizontal intercept for ${target.date}`);
    const fireAt = time + duration;
    const move = { target: target.date, startAt: time, endAt: fireAt, fromY: y, toY: aimY, selectedX: invaderPositionAt(target, time).x };
    moves.push(move);
    shots.push({ id: `shot-${target.date}`, target: target.date, selectedAt: time, selectedX: move.selectedX, fireAt, hitAt: intercept.time, destroyedAt: intercept.time + explosion.duration,
      origin: { x: originX, y: aimY }, impact: { x: intercept.x, y: aimY }, targetImpactY: intercept.y,
      speed: gameplay.projectileSpeed, alignmentTolerance: tolerance,
      alignmentError: Math.abs(aimY - invaderPositionAt(target, fireAt).y - half) });
    available.splice(available.indexOf(target), 1); // LOCKED at fire; never selected twice.
    time = fireAt; y = aimY; // Select/move immediately, independently of any hit.
  }
  const completeAt = Math.max(time, ...shots.map(s => s.destroyedAt));
  const events = shots.flatMap(s => [{ time: s.fireAt, change: 1 }, { time: s.hitAt, change: -1 }]).sort((a, b) => a.time - b.time || a.change - b.change);
  let count = 0, maxConcurrent = 0;
  for (const e of events) { count += e.change; maxConcurrent = Math.max(maxConcurrent, count); }
  return { startAt: gameplay.startAt, completeAt, moves, shots, maxConcurrent, selection: 'minimum current x, then ISO date', movingTarget: 'predicted horizontal intercept' };
}

export function gameplayStateAt(timeline, time) {
  const locked = timeline.shots.filter(s => s.fireAt <= time && s.hitAt > time);
  const exploding = timeline.shots.filter(s => s.hitAt <= time && s.destroyedAt > time);
  const destroyed = timeline.shots.filter(s => s.destroyedAt <= time);
  return { current: timeline.moves.find(m => m.startAt <= time && m.endAt > time)?.target || null,
    available: timeline.shots.filter(s => s.fireAt > time).map(s => s.target),
    locked: locked.map(s => s.target), exploding: exploding.map(s => s.target), destroyed: destroyed.map(s => s.target),
    bullets: locked.map(s => ({ id: s.id, target: s.target, x: s.origin.x + s.speed * (time - s.fireAt), y: s.origin.y })) };
}

export function gameplayStyles() {
  return `.target-life{animation:target-hit ${explosion.absorbDuration}s linear var(--hit-at) 1 forwards}
@keyframes target-hit{from{opacity:1}to{opacity:0}}
.projectile{opacity:0;animation:projectile-flight var(--flight) linear var(--fire-at) 1 forwards;transform:translate(var(--origin-x),var(--shot-y))}
@keyframes projectile-flight{0%{opacity:1;transform:translate(var(--origin-x),var(--shot-y))}99.999%{opacity:1}100%{opacity:0;transform:translate(var(--impact-x),var(--shot-y))}}
@media(prefers-reduced-motion:reduce){.projectiles{display:none!important}}`;
}

export function projectileMarkup(timeline, theme = 'dark') {
  const n = v => Number(v.toFixed(6));
  return `<g class="projectiles" clip-path="url(#field)" fill="${theme === 'light' ? 'text' : projectileVisual.color}">${timeline.shots.map(s => `<path class="projectile" data-shot="${s.id}" data-target="${s.target}" d="${projectileShape}" style="--flight:${n(s.hitAt - s.fireAt)}s;--fire-at:${n(s.fireAt)}s;--origin-x:${n(s.origin.x)}px;--impact-x:${n(s.impact.x)}px;--shot-y:${n(s.origin.y)}px"/>`).join('')}</g>`;
}
