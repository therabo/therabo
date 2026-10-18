import { invaderGeometry } from './motion-geometry.mjs';

// One short, independent SVG burst per hit. Geometry includes the round caps.
export const explosion = Object.freeze({
  duration: .38,
  absorbDuration: .07,
  flashDuration: .07,
  burstStart: .02,
  burstDuration: .20,
  fragmentStart: .16,
  fragmentDuration: .22,
  peakDiameter: invaderGeometry.size * 1.8,
  strokeWidth: .8,
  fragmentCount: 6,
  reducedDuration: .12,
});
const n = v => Number(v.toFixed(6));

export function explosionFreezeIterations(plan, shot) {
  // A fractional final iteration ends at precisely hitAt, retaining that pose.
  // Zero iterations is correct when impact precedes the first individual move.
  return Math.max(0, (shot.hitAt - plan.startAt) / plan.period);
}

export function explosionMarkup(timeline, plans) {
  const byDate = new Map(plans.map(p => [p.date, p]));
  const radius = explosion.peakDiameter / 2 - explosion.strokeWidth / 2;
  const inner = 5.6, diagonal = radius / Math.SQRT2, diagonalInner = inner / Math.SQRT2;
  const cardinal = `M${inner} 0H${radius}M-${inner} 0H-${radius}M0 ${inner}V${radius}M0 -${inner}V-${radius}`;
  const diagonals = [1, -1].flatMap(x => [1, -1].map(y => `M${n(x * diagonalInner)} ${n(y * diagonalInner)}L${n(x * diagonal)} ${n(y * diagonal)}`)).join('');
  return `<g class="hit-explosions" clip-path="url(#field)">${timeline.shots.map(shot => {
    const plan = byDate.get(shot.target), scale = plan?.scale || 1;
    // targetImpactY is the actual invader centre, even if ship Y was clamped.
    const x = shot.impact.x, y = shot.targetImpactY;
    const originalX = (plan?.x ?? x - 6) + invaderGeometry.size / 2;
    const originalY = (plan?.y ?? y - 6) + invaderGeometry.size / 2;
    const fragments = Array.from({ length: explosion.fragmentCount }, (_, i) => {
      const a = i * Math.PI * 2 / explosion.fragmentCount, size = i % 2 ? .8 : 1.1;
      return `<rect class="explosion-fragment" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" fill="${i % 2 ? 'accent' : '#ffffff'}" style="--from-x:${n(Math.cos(a) * 5.6)}px;--from-y:${n(Math.sin(a) * 5.6)}px;--end-x:${n(Math.cos(a) * 9.8)}px;--end-y:${n(Math.sin(a) * 9.8)}px"/>`;
    }).join('');
    return `<g class="hit-explosion" data-target="${shot.target}" data-explodes-at="${n(shot.hitAt)}" data-destroyed-at="${n(shot.destroyedAt)}" data-impact-x="${n(x)}" data-impact-y="${n(y)}" transform="translate(${n(x)} ${n(y)})" style="--hit-at:${n(shot.hitAt)}s;--reduced-x:${n(originalX)}px;--reduced-y:${n(originalY)}px"><g class="explosion-art" transform="scale(${scale})"><path class="explosion-flash" fill="#ffffff" d="M0-6 1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5Z"/><g class="explosion-rays" fill="none" stroke-width="${explosion.strokeWidth}" stroke-linecap="round"><path stroke="#ffffff" d="${cardinal}"/><path stroke="accent" d="${diagonals}"/></g>${fragments}</g></g>`;
  }).join('')}</g>`;
}

export function explosionStyles() {
  return `.hit-explosion{opacity:0;animation:arcade-explosion ${explosion.duration}s linear var(--hit-at) 1 forwards}
@keyframes arcade-explosion{0%,99.999%{opacity:1}100%{opacity:0}}
.explosion-flash{opacity:0;transform-origin:0 0;animation:arcade-flash ${explosion.flashDuration}s linear var(--hit-at) 1 forwards}
@keyframes arcade-flash{0%{opacity:1;transform:scale(1)}55%{opacity:1;transform:scale(1.1)}100%{opacity:0;transform:scale(1.18)}}
.explosion-rays{opacity:0;transform-origin:0 0;animation:arcade-rays ${explosion.burstDuration}s linear calc(var(--hit-at) + ${explosion.burstStart}s) 1 forwards}
@keyframes arcade-rays{0%{opacity:0;transform:scale(.58)}10%{opacity:1}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
.explosion-fragment{opacity:0;transform-origin:0 0;animation:arcade-fragment ${explosion.fragmentDuration}s cubic-bezier(.15,.55,.45,1) calc(var(--hit-at) + ${explosion.fragmentStart}s) 1 forwards}
@keyframes arcade-fragment{0%{opacity:1;transform:translate(var(--from-x),var(--from-y)) scale(1)}72%{opacity:.65}100%{opacity:0;transform:translate(var(--end-x),var(--end-y)) scale(.7)}}
@media(prefers-reduced-motion:reduce){.hit-explosion{transform:translate(var(--reduced-x),var(--reduced-y))!important;animation:arcade-static-burst ${explosion.reducedDuration}s steps(1,end) var(--hit-at) 1 forwards!important}.explosion-art{transform:none!important}.explosion-flash,.explosion-fragment{display:none!important;animation:none!important}.explosion-rays{animation:none!important;opacity:1!important;transform:scale(.8)!important}}
@keyframes arcade-static-burst{0%{opacity:1}100%{opacity:0}}`;
}
