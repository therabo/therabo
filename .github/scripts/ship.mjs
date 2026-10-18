import { canvas, region, hordeVerticalRange } from './motion-geometry.mjs';

// Hand-traced pixel silhouette, cockpit and engine outlets.
// The reference points upward; the SVG rotates it clockwise to face the horde.
const pixels = [
  '......#......',
  '......#......',
  '.....###.....',
  '.....###.....',
  '....#####....',
  '....##.##....',
  '...##...##...',
  '...##...##...',
  '..###...###..',
  '..####.####..',
  '.###.###.###.',
  '.###########.',
  '######.######',
  '###.#####.###',
  '##...###...##',
  '#.....#.....#',
  '...#.....#...',
  '...#..#..#...',
  '......#......',
];
const pixelSize = 1.5;
export const ship = Object.freeze({
  width: pixels.length * pixelSize,
  height: pixels[0].length * pixelSize,
  enterAt: region.deployAt + .2,
  duration: region.deployDuration - .2,
  entryY: canvas.top + canvas.height * .25,
  entryAngle: 26,
  finalX: (canvas.left + region.left) / 2,
  finalY: canvas.top + canvas.height / 2,
});

// Enter already moving, then level out on a descending cubic arc. The entry
// pitch follows the curve's tangent at a restrained angle, reaching zero at rest.
// The quintic timing retains entry speed and ends with zero speed/acceleration.
// Sampled transforms work in self-contained SVG images without motion-path/JS.
function trajectory(progress, flight) {
  const p = Math.max(0, Math.min(1, progress));
  const velocity = 1.4;
  const q = Math.max(0, Math.min(1, velocity * p + (10 - 6 * velocity) * p ** 3 + (8 * velocity - 15) * p ** 4 + (6 - 3 * velocity) * p ** 5));
  const angle = ship.entryAngle * Math.PI / 180;
  const startX = canvas.left - (ship.width * Math.cos(angle) + ship.height * Math.sin(angle)) / 2;
  const a = { x: startX, y: ship.entryY }, b = { x: startX + 26, y: ship.entryY + 24 };
  const finalX = flight?.finalX ?? ship.finalX, finalY = flight?.finalY ?? ship.finalY;
  const c = { x: finalX - 28, y: finalY }, d = { x: finalX, y: finalY };
  const dx = 3 * ((1 - q) ** 2 * (b.x - a.x) + 2 * (1 - q) * q * (c.x - b.x) + q * q * (d.x - c.x));
  const dy = 3 * ((1 - q) ** 2 * (b.y - a.y) + 2 * (1 - q) * q * (c.y - b.y) + q * q * (d.y - c.y));
  return {
    x: (1 - q) ** 3 * a.x + 3 * (1 - q) ** 2 * q * b.x + 3 * (1 - q) * q * q * c.x + q ** 3 * d.x,
    y: (1 - q) ** 3 * a.y + 3 * (1 - q) ** 2 * q * b.y + 3 * (1 - q) * q * q * c.y + q ** 3 * d.y,
    angle: ship.entryAngle * Math.atan2(dy, dx) / Math.atan2(b.y - a.y, b.x - a.x),
  };
}

// Read the last row containing three isolated engine stems from the actual
// traced silhouette. Each outlet is the rear edge of its final filled pixel.
const engineRow = pixels.findLastIndex(row => {
  const runs = [...row.matchAll(/#+/g)];
  return runs.length === 3 && runs.every(run => run[0].length === 1);
});
export const shipEngines = Object.freeze([...pixels[engineRow].matchAll(/#+/g)].map(run => {
  const u = run.index + run[0].length / 2;
  const v = pixels.findLastIndex(row => row[run.index] === '#') + 1;
  const x = ship.width / 2 - v * pixelSize, y = -ship.height / 2 + u * pixelSize;
  return Object.freeze({ id: y === 0 ? 'center' : y < 0 ? 'upper' : 'lower', u, v, x, y });
}));
export const shipTrail = Object.freeze(shipEngines.map(engine => Object.freeze({
  ...engine, length: engine.id === 'center' ? 16 : 12,
  strokeWidth: engine.id === 'center' ? 1.1 : .7,
  lag: engine.id === 'center' ? .22 : .16,
})));
// Post-entry pitch is zero and the hull has no stroke. Cubic control points use recent
// engine positions, all within the same centre range; include stroke half-width.
export const shipSafeVerticalRange = (() => {
  const invaders = hordeVerticalRange();
  const halfHeight = Math.max(ship.height / 2, ...shipTrail.map(w => Math.abs(w.y) + w.strokeWidth / 2));
  return Object.freeze({ invaders: Object.freeze(invaders), halfHeight, top: Number((invaders.top + halfHeight).toFixed(6)), bottom: Number((invaders.bottom - halfHeight).toFixed(6)) });
})();
// Target-driven manoeuvres use a quintic ease with zero endpoint velocity and
// acceleration. No autonomous idle orbit; an empty/finished timeline holds still.
const round = n => Number(n.toFixed(6));
export function shipPoseAt(time, timeline) {
  const startAt = ship.enterAt + ship.duration;
  if (time < startAt) return trajectory((time - ship.enterAt) / ship.duration, timeline?.flight);
  const flight = timeline?.flight;
  if (flight?.period && time >= flight.repeatAt) time = flight.repeatAt + (time - flight.repeatAt) % flight.period;
  let y = flight?.finalY ?? ship.finalY;
  for (const move of timeline?.moves || []) {
    if (time < move.startAt) break;
    if (time >= move.endAt) { y = move.toY; continue; }
    const p = (time - move.startAt) / (move.endAt - move.startAt);
    const ease = p ** 3 * (10 - 15 * p + 6 * p * p);
    y = move.fromY + (move.toY - move.fromY) * ease;
    break;
  }
  return { x: flight?.finalX ?? ship.finalX, y, angle: 0 };
}

export function shipTrailCurve(engine, time, timeline) {
  const pose = shipPoseAt(time, timeline), angle = pose.angle * Math.PI / 180;
  const history = fraction => {
    const past = shipPoseAt(time - engine.lag * fraction, timeline), a = past.angle * Math.PI / 180;
    const x = engine.x - engine.length * fraction, y = engine.y;
    const wx = past.x + x * Math.cos(a) - y * Math.sin(a) - pose.x;
    const wy = past.y + x * Math.sin(a) + y * Math.cos(a) - pose.y;
    return { x: wx * Math.cos(angle) + wy * Math.sin(angle), y: -wx * Math.sin(angle) + wy * Math.cos(angle) };
  };
  const start = { x: engine.x, y: engine.y };
  // The initial tangent exits along the nozzle axis, then bends through recent
  // engine positions. All three paths share the hull's current rigid transform.
  const c1 = { x: engine.x - engine.length * .28, y: engine.y };
  const c2 = history(.68), end = history(1);
  const p = q => `${round(q.x)} ${round(q.y)}`;
  return { start, c1, c2, end, d: `M ${p(start)} C ${p(c1)} ${p(c2)} ${p(end)}` };
}

export function shipStyles(timeline, timeOffset = 0, entryTiming) {
  if (timeline?.flight?.period) return repeatingFlightStyles(timeline, timeOffset);
  const steps = 128;
  const frames = Array.from({ length: steps + 1 }, (_, i) => {
    const p = trajectory(i / steps);
    return `${round(i / steps * 100)}%{transform:translate(${round(p.x)}px,${round(p.y)}px) rotate(${round(p.angle)}deg);opacity:${i ? 1 : 0}}`;
  });
  const startAt = ship.enterAt + ship.duration;
  // Invader-only playback override. Entry geometry and history-derived trail
  // frames are still generated on the original canonical clock.
  const entryDuration = entryTiming?.duration ?? ship.duration;
  const entryAt = entryTiming?.start ?? round(ship.enterAt-timeOffset);
  const lastMoveAt = timeline?.moves.at(-1)?.endAt || startAt;
  const duration = Math.max(.001, lastMoveAt - startAt + Math.max(...shipTrail.map(w => w.lag)));
  // Sample the deterministic manoeuvres and recent-motion trails on a shared
  // clock. Include exact move boundaries and lagged boundaries in the SVG knots.
  const times = new Set([startAt, startAt + duration]);
  for (const m of timeline?.moves || []) {
    const samples = Math.max(48, Math.ceil((m.endAt - m.startAt) * 30));
    for (let i = 0; i <= samples; i++) times.add(m.startAt + (m.endAt - m.startAt) * i / samples);
  }
  for (let i = 1; i < 9; i++) times.add(lastMoveAt + (startAt + duration - lastMoveAt) * i / 9);
  for (const m of timeline?.moves || []) for (const t of [m.startAt, m.endAt]) {
    times.add(t);
    for (const w of shipTrail) for (const lag of [w.lag * .68, w.lag]) if (t + lag <= startAt + duration) times.add(t + lag);
  }
  const knots = [...times].sort((a, b) => a - b);
  const moveFrames = knots.map(t => {
    const p = shipPoseAt(t, timeline);
    return `${round((t - startAt) / duration * 100)}%{transform:translate(${round(p.x)}px,${round(p.y)}px) rotate(0deg)}`;
  }).join('');
  const trailFrames = (engine, start, duration, steps) => Array.from({ length: steps + 1 }, (_, i) =>
    `${round(i / steps * 100)}%{d:path("${shipTrailCurve(engine, start + duration * i / steps, timeline).d}")}`).join('');
  const trails = shipTrail.map(engine => `.ship-trail-${engine.id}{animation:trail-${engine.id}-entry ${entryDuration}s linear ${entryAt}s 1 both,trail-${engine.id}-targets ${round(duration)}s linear ${round(startAt-timeOffset)}s 1 forwards}
@keyframes trail-${engine.id}-entry{${trailFrames(engine, ship.enterAt, ship.duration, 64)}}
@keyframes trail-${engine.id}-targets{${knots.map(t => `${round((t - startAt) / duration * 100)}%{d:path("${shipTrailCurve(engine, t, timeline).d}")}`).join('')}}`).join('\n');
  return `.ship-entry{transform-origin:0 0;animation:ship-arrival ${entryDuration}s linear ${entryAt}s 1 both,ship-targets ${round(duration)}s linear ${round(startAt-timeOffset)}s 1 forwards}
@keyframes ship-arrival{${frames.join('')}}
@keyframes ship-targets{${moveFrames}}
${trails}
@media(prefers-reduced-motion:reduce){.ship-motion,.ship-engine-trail{animation:none!important}.ship-engine-trail{display:none!important}}`;
}

export function shipMarkup(theme = 'dark', timeline) {
  const path = pixels.flatMap((row, y) => [...row.matchAll(/#+/g)].map(run =>
    `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`)).join('');
  const color = theme === 'dark' ? '#e4e8ec' : '#6b747d';
  const gradients = shipTrail.map(w => `<linearGradient id="ship-trail-${w.id}" gradientUnits="userSpaceOnUse" x1="${w.x}" y1="${w.y}" x2="${w.x - w.length}" y2="${w.y}"><stop offset="0" stop-color="${color}" stop-opacity=".42"/><stop offset=".55" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`).join('');
  const trails = shipTrail.map(w => `<path class="ship-engine-trail ship-trail-${w.id}" data-engine="${w.id}" d="${shipTrailCurve(w, ship.enterAt, timeline).d}" fill="none" stroke="url(#ship-trail-${w.id})" stroke-width="${w.strokeWidth}" stroke-linecap="round"/>`).join('');
  return `<g class="ship" clip-path="url(#field)"><defs>${gradients}</defs><g class="ship-entry ship-motion">${trails}<g transform="translate(${ship.width / 2} ${-ship.height / 2}) rotate(90) scale(${pixelSize})"><path fill="text" opacity=".9" shape-rendering="geometricPrecision" d="${path}"/></g></g></g>`;
}

// Optional scene flight profile. Hull, entry curve, easing and history-derived
// cubic trails are the same primitives as Invader Mode; its default CSS is untouched.
function repeatingFlightStyles(timeline, timeOffset = 0) {
  const startAt = ship.enterAt + ship.duration;
  const { repeatAt, period } = timeline.flight;
  const knots = (start, end) => {
    const times = new Set([start, end]);
    for (const m of timeline.moves) {
      if (m.endAt < start || m.startAt > end) continue;
      const count = Math.max(48, Math.ceil((m.endAt - m.startAt) * 40));
      for (let i = 0; i <= count; i++) times.add(m.startAt + (m.endAt - m.startAt) * i / count);
      for (const w of shipTrail) for (const lag of [w.lag * .68, w.lag]) {
        for (let i = 0; i <= 24; i++) times.add(m.endAt + lag * i / 24);
      }
    }
    return [...times].filter(t => t >= start && t <= end).sort((a, b) => a - b);
  };
  const intro = knots(startAt, repeatAt), loop = knots(repeatAt, repeatAt + period);
  const transform = t => {
    const p = shipPoseAt(t, timeline);
    return `transform:translate(${round(p.x)}px,${round(p.y)}px) rotate(${round(p.angle)}deg)`;
  };
  const frames = (times, start, duration, value) => times.map(t => `${round((t - start) / duration * 100)}%{${value(t)}}`).join('');
  const entryTimes = Array.from({length:129}, (_,i) => ship.enterAt + ship.duration * i / 128);
  const entry = frames(entryTimes, ship.enterAt, ship.duration, t => `${transform(t)};opacity:${t > ship.enterAt ? 1 : 0}`);
  const introDuration = round(repeatAt - startAt);
  const delay = time => timeOffset ? round(time - timeOffset) : time;
  const animations = name => `${name}-entry ${ship.duration}s linear ${delay(ship.enterAt)}s 1 both,${name}-intro ${introDuration}s linear ${delay(startAt)}s 1 forwards,${name}-loop ${period}s linear ${delay(repeatAt)}s infinite`;
  const trails = shipTrail.map(w => {
    const value = t => `d:path("${shipTrailCurve(w,t,timeline).d}")`;
    return `.ship-trail-${w.id}{animation:${animations('meteor-trail-'+w.id)}}
@keyframes meteor-trail-${w.id}-entry{${frames(entryTimes,ship.enterAt,ship.duration,value)}}
@keyframes meteor-trail-${w.id}-intro{${frames(intro,startAt,introDuration,value)}}
@keyframes meteor-trail-${w.id}-loop{${frames(loop,repeatAt,period,value)}}`;
  }).join('\n');
  return `.ship-entry{transform-origin:0 0;animation:${animations('meteor-ship')}}
@keyframes meteor-ship-entry{${entry}}
@keyframes meteor-ship-intro{${frames(intro,startAt,introDuration,transform)}}
@keyframes meteor-ship-loop{${frames(loop,repeatAt,period,transform)}}
${trails}
@media(prefers-reduced-motion:reduce){.ship-motion,.ship-engine-trail{animation:none!important}.ship-engine-trail{display:none!important}}`;
}
