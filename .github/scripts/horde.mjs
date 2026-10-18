import { createDeployment } from './organic-deployment.mjs';
import { region, motionCaps, motionEnvelopes, invaderVerticalMotion } from './motion-geometry.mjs';
import { motionRandomFor as randomFor } from './random.mjs';

// Approved individual manoeuvres around validated organic anchors; no shared motion.
export const horde = Object.freeze({ left: region.left, right: region.right, settleAt: region.deployAt, settleDuration: region.deployDuration, moveAt: 17.6, cycleMin: 36, cycleRange: 18, movementSpeedMultiplier: 1.30 * 1.15 });
const round = n => Number(n.toFixed(6));

// Horizontal sides are independent. Vertical travel keeps the approved envelopes.
// Only facing sides compete for a gap; a neighbour on the left cannot consume
// the outward right-side room. Every final rectangle is safe at arbitrary phases.
export function planHorde(cells, mobile = false, deployment = createDeployment(cells)) {
  const selected = deployment.selectedDates ? new Set(deployment.selectedDates) : null;
  const active = cells.filter(c => c.count > 0 && (!selected || selected.has(c.date)));
  if (!active.length) return [];
  const { scale, anchors, caps, paths } = deployment;
  const envelopes = motionEnvelopes(anchors, scale, caps);
  return active.map((c, index) => {
    const random = randomFor(`${c.date}:${c.level}`);
    const between = (a, b) => a + random() * (b - a);
    // Consume the two former anchor jitter draws: approved paths/phases stay exact.
    random(); random();
    const { x: finalX, y: finalY } = anchors[index];
    const envelope = envelopes[index];
    const requestedX = between(18, 27) * scale, requestedY = between(4, invaderVerticalMotion.maximum) * scale;
    const amplitudeLeft = Math.min(envelope.availableLeft, requestedX) * (mobile ? .86 : 1);
    const amplitudeRight = Math.min(envelope.availableRight, requestedX) * (mobile ? .86 : 1);
    const amplitudeUp = Math.min(envelope.availableUp, requestedY) * (mobile ? .9 : 1);
    const amplitudeDown = Math.min(envelope.availableDown, requestedY) * (mobile ? .9 : 1);
    const amplitudeX = Math.max(amplitudeLeft, amplitudeRight), amplitudeY = Math.max(amplitudeUp, amplitudeDown);
    const direction = random() < .6 ? -1 : 1;
    const firstVertical = random() < .28 ? -1 : 1;
    const coordinates = [
      [0, 0],
      [direction * between(.6, .95), firstVertical * between(.25, .65)],
      [direction * between(.2, .5), firstVertical * between(.65, 1)],
      [-direction * between(.55, .95), between(.15, .65)],
      [-direction * between(.25, .6), -between(.6, 1)],
      [direction * between(.15, .5), -between(.1, .5)],
      [direction * between(.6, 1), between(.3, .85)],
      [-direction * between(.25, .55), between(.1, .5)],
      [0, 0],
    ];
    const weights = Array.from({ length: coordinates.length - 1 }, () => between(.75, 1.3));
    const total = weights.reduce((a, b) => a + b, 0);
    let elapsed = 0;
    const points = coordinates.map(([x, y], i) => {
      if (i) elapsed += weights[i - 1];
      return { percent: i === coordinates.length - 1 ? 100 : round(elapsed / total * 100), x: round(x * (x < 0 ? amplitudeLeft : amplitudeRight)), y: round(y * (y < 0 ? amplitudeUp : amplitudeDown)), ease: [round(between(.25, .42)), 0, round(between(.55, .72)), 1] };
    });
    const tx = finalX - c.x * scale, ty = finalY - c.y * scale;
    random(); // Former settle jitter; retain the approved period/phase random stream.
    return { ...c, id: `horde-${c.date}`, scale, finalX, finalY, tx, ty,
      envelope, amplitudeLeft, amplitudeRight, amplitudeUp, amplitudeDown, requestedX,
      amplitudeX, amplitudeY, settleAt: horde.settleAt, deployment: paths[index].frames,
      // Preserve the exact approved random duration, scaling only its clock.
      // CSS animation and intercept prediction both consume this same period.
      period: round(between(horde.cycleMin, horde.cycleMin + horde.cycleRange)) / horde.movementSpeedMultiplier,
      startAt: round(horde.moveAt + between(0, 1.8)), points,
    };
  });
}

export function hordeStyles(plans, settleAt = horde.settleAt, settleDuration = horde.settleDuration) {
  return `.deploy{transform-origin:0 0;animation-duration:${settleDuration}s;animation-timing-function:linear;animation-delay:${settleAt}s;animation-iteration-count:1;animation-fill-mode:both}
${plans.map(p => `@keyframes deploy-${p.date}{${p.deployment.map(q => `${q.percent}%{transform:translate(${q.tx}px,${q.ty}px) scale(${q.scale})}`).join('')}}`).join('\n')}
.horde-invader{animation-iteration-count:infinite;animation-fill-mode:both;animation-timing-function:linear;transform-origin:0 0}
${plans.map(p => `@keyframes ${p.id}{${p.points.map(q => `${q.percent}%{transform:translate(${q.x}px,${q.y}px);animation-timing-function:cubic-bezier(${q.ease.join(',')})}`).join('')}}`).join('\n')}`;
}
