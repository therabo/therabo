import { svg, escapeXml } from './graphics.mjs';
import { normalizeCalendar } from './contribution-calendar.mjs';
import { planHorde, hordeStyles, horde } from './horde.mjs';
import { createDeployment } from './organic-deployment.mjs';
import { ship, shipMarkup, shipStyles } from './ship.mjs';
import { planGameplay, gameplayStyles, projectileMarkup } from './gameplay.mjs';
import { starLayer, createStarfield } from './space-visuals.mjs';
import { explosionMarkup, explosionStyles, explosionFreezeIterations } from './hit-explosion.mjs';
import { invaderGeometry } from './motion-geometry.mjs';
import { invaderMorphTiming, invaderPositioningTiming, shiftGameplayTimeline } from './invader-timing.mjs';
import { planInvaderEnding, invaderEndingMarkup, invaderEndingStyles } from './invader-ending.mjs';
import { planSimpleReset, wrapSimpleReset } from './simple-reset.mjs';

import { graph, contributionColors, sequence, layoutCalendar } from './contribution-scene.mjs';

function animationStyle(plans, gameplay, timing, positioning) {
  return `<style>
.eye,.notch{transform:scale(0);transform-box:fill-box;animation:carve ${timing.cellDuration}s cubic-bezier(.3,0,.35,1) var(--delay) 1 both}
.eye{transform-origin:center}.notch{transform-origin:var(--origin)}
@keyframes carve{0%{transform:scale(0)}25%{transform:scale(.4)}65%{transform:scale(.8)}100%{transform:scale(1)}}
.notch{animation-name:edge}
@keyframes edge{0%,25%{transform:scale(0)}60%{transform:scale(.42)}100%{transform:scale(1)}}
.active{animation:rim ${timing.cellDuration}s ease var(--delay) 1 both}
@keyframes rim{0%,20%{stroke-opacity:1}100%{stroke-opacity:0}}
.omitted{animation:retire ${timing.cellDuration}s cubic-bezier(.3,0,.35,1) var(--retire-delay) 1 both}
@keyframes retire{0%,12%{opacity:1}35%{opacity:.82}68%{opacity:.32}100%{opacity:0}}
.empty{animation:quiet ${timing.cellDuration}s ease var(--delay) 1 both}
@keyframes quiet{0%,20%{opacity:1}100%{opacity:0}}
.space{opacity:0;animation:space-in ${timing.starsFade}s ease-in-out ${timing.starsAt}s 1 both}
@keyframes space-in{from{opacity:0}to{opacity:1}}
.far{animation:parallax ${sequence.farPeriod}s linear infinite}.near{animation:parallax ${sequence.nearPeriod}s linear infinite}
@keyframes parallax{to{transform:translateX(-${graph.width}px)}}
${hordeStyles(plans, positioning.new.deployment.start, positioning.new.deployment.duration)}
${shipStyles(gameplay, timing.timeSaved, positioning.new.ship)}
${gameplayStyles()}
${explosionStyles()}
${invaderEndingStyles()}
@media(prefers-reduced-motion:reduce){.eye,.notch{animation:none!important;transform:scale(0)!important}.active,.empty,.omitted{animation:none!important;opacity:1!important;stroke-opacity:1!important}.space{animation:none!important;opacity:0!important}.far,.near,.deploy,.horde-invader{animation:none!important;transform:none!important}.ship{display:none!important}}
</style>`;
}

function cellMask(c, delay) {
  // One original rectangle is gradually carved; no second sprite or crossfade.
  // Edge cuts grow inward from their anchor; two eye openings grow from centres.
  const cuts = [
    ['notch', -1, -1, 3, 3, '0% 0%'], ['notch', 10, -1, 3, 3, '100% 0%'],
    ['notch', -1, 8, 3, 5, '0% 100%'], ['notch', 10, 8, 3, 5, '100% 100%'],
    ['notch', 4, 10, 4, 3, '50% 100%'],
    ['eye', 2, 4, 2, 2, '50% 50%'], ['eye', 8, 4, 2, 2, '50% 50%'],
  ];
  return `<mask id="cell-${c.date}" maskUnits="userSpaceOnUse" x="${c.x - 1}" y="${c.y - 1}" width="14" height="14" style="--delay:${delay}s"><rect x="${c.x - 1}" y="${c.y - 1}" width="14" height="14" fill="white"/><g transform="translate(${c.x} ${c.y})" fill="black">${cuts.map(([cls, x, y, w, h, origin]) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" style="--origin:${origin}"/>`).join('')}</g></mask>`;
}

export function contributionInvaders(input, theme = 'dark', mobile = false, stationary = false, deployment, starfield) {
  const calendar = normalizeCalendar(input);
  const cells = layoutCalendar(calendar, mobile);
  const configuration = stationary ? null : deployment || createDeployment(cells);
  const plans = stationary ? [] : planHorde(cells, mobile, configuration);
  const timing = stationary ? null : invaderMorphTiming(cells, configuration);
  const positioning = stationary ? null : invaderPositioningTiming(timing);
  const clock = stationary ? null : { ...timing, after: positioning.after, timeSaved: positioning.timelineOffset };
  const canonicalGameplay = stationary ? null : planGameplay(plans);
  const gameplay = stationary ? null : shiftGameplayTimeline(canonicalGameplay, clock.timeSaved);
  const ending = stationary ? null : planInvaderEnding(gameplay);
  const sky = stationary ? null : starfield || createStarfield();
  const shots = new Map(gameplay?.shots.map(s => [s.target, s]) || []);
  const canonicalShots = new Map(canonicalGameplay?.shots.map(s => [s.target, s]) || []);
  const reset = stationary ? null : planSimpleReset(ending);
  const delay = c => timing?.delay(c);
  let body = '';
  if (!stationary) {
    body += `<metadata>${escapeXml(JSON.stringify({ algorithm: configuration.algorithm, seed: configuration.seed, attempt: configuration.attempt, metrics: configuration.metrics, totalActiveDays: configuration.totalActiveDays, displayedInvaders: configuration.displayedInvaders, samplingRatio: configuration.samplingRatio, densityMode: configuration.densityMode, spriteScale: configuration.scale, selectedDates: configuration.selectedDates, sampling: configuration.sampling, capacity: configuration.capacity, routeMode: configuration.routeMode, morphTiming: timing, gameplay, ending, starfield: sky, reset, positioning }))}</metadata>`;
    body += '<defs><clipPath id="field"><rect x="-16" y="-32" width="880" height="192"/></clipPath>';
    for (const c of cells.filter(c => plans.some(p => p.date === c.date))) body += cellMask(c, delay(c));
    body += '</defs>' + animationStyle(plans, canonicalGameplay, clock, positioning);
    body += `<g class="space" clip-path="url(#field)">${starLayer(false, theme, sky)}${starLayer(true, theme, sky)}</g>`;
  }
  const targets = new Map(plans.map(c => [c.date, c]));
  const number = n => Number(n.toFixed(6));
  const fade = c => timing.retire(c);
  const rectangle = c => {
    const active = c.count > 0;
    const retained = active && targets.has(c.date);
    const motion = stationary ? '' : ` class="${active ? (retained ? 'active' : 'omitted') : 'empty'}" style="--delay:${delay(c)}s${active && !retained ? `;--retire-delay:${fade(c)}s` : ''}"${retained ? ` mask="url(#cell-${c.date})"` : ''}`;
    return `<rect data-date="${c.date}" data-count="${c.count}" data-level="${c.level}" x="${c.x}" y="${c.y}" width="${graph.size}" height="${graph.size}" rx="2" ry="2" fill="${contributionColors[theme][c.level]}" stroke="#1b1f230a" stroke-width="${invaderGeometry.strokeWidth}" shape-rendering="geometricPrecision"${motion}/>`;
  };
  if (stationary) body += cells.map(rectangle).join('');
  else {
    body += `<g class="invader-gameplay" style="--cleanup-at:${ending.cleanupAt}s">`;
    body += cells.filter(c => !c.count).map(rectangle).join('');
    for (const c of cells.filter(c => c.count > 0)) {
      const t = targets.get(c.date);
      if (!t) { body += rectangle(c); continue; }
      body += `<g class="target-life" data-target="${c.date}" data-fire-at="${number(shots.get(c.date).fireAt)}" data-hit-at="${number(shots.get(c.date).hitAt)}" style="--hit-at:${number(shots.get(c.date).hitAt)}s"><g class="horde-invader" data-motion="${t.id}" style="animation-name:${t.id};animation-duration:${t.period}s;animation-delay:${clock.after(t.startAt)}s;animation-iteration-count:${explosionFreezeIterations(t, canonicalShots.get(c.date))}"><g class="deploy" data-final-x="${number(t.finalX)}" data-final-y="${number(t.finalY)}" style="animation-name:deploy-${c.date}">${rectangle(c)}</g></g></g>`;
    }
    body += projectileMarkup(gameplay, theme) + explosionMarkup(gameplay, plans) + '</g>' + shipMarkup(theme) + invaderEndingMarkup(ending);
  }

  const desc = `Actual GitHub contribution calendar, ${calendar.days[0].date} to ${calendar.days.at(-1).date}. Original 12-pixel squares on a 16-pixel grid. ${cells.filter(c => c.count > 0).length} active days reveal eyes and edge notches in a single left-to-right geometric transformation lasting 12 seconds. Contribution colors and positions stay unchanged. Empty days fade away; they never become invaders. Stars appear after 4.4 seconds and move slowly right to left at two depths. The final formation stays still. Mobile preserves the same calendar geometry. Reduced motion and the static fallback show the complete initial graph without stars.`;
  let description = stationary ? desc : desc.replace('Contribution colors and positions stay unchanged.', 'Contribution colors stay unchanged. Positions are preserved through the morph.').replace('The final formation stays still.', 'After the original morph, each invader deploys along its own path into a density-preserving organic arrangement on the right. Generation-time random offsets retain original clusters and negative space. From 17.6 seconds, individual lateral advances, descents and upward recoveries use distinct deterministic phases, paths and periods. No moving parent carries the horde. The left 15 percent remains reserved after deployment.');
  if (!stationary && configuration.densityMode === 'representative') description = `The complete real contribution graph is shown initially, including all ${configuration.totalActiveDays} active days. During the morph, ${configuration.displayedInvaders} representative blocks become full-size 12-pixel invaders; the other active blocks fade gently at staggered times while the original stars emerge. The representative horde is not a one-to-one quantitative count of days. Cluster, outlier and separation diagnostics are in metadata. ` + description.replace(`${configuration.totalActiveDays} active days reveal`, `${configuration.displayedInvaders} selected active days reveal`);
  if (!stationary) description += ` A pixel spacecraft enters from the upper left at one quarter of the scene height during deployment, from 13.2 to 17.4 seconds. It dives gently along a curved path, progressively levelling from 26 degrees nose-down to horizontal at the centre of the reserved left area. After entry, it moves vertically toward the available invader with the smallest current x, breaking exact ties by date. It fires a constant-speed horizontal projectile at a predicted intercept, locks that target and immediately moves toward the next one while earlier shots continue independently. At impact each invader freezes in place, blends into a short white and aqua arcade burst, then disappears; after all targets have been fired upon the ship holds its last position. Three faint, curved vector trails attach to its engine outlets; the central trail is longer and wider. Reduced motion keeps the spacecraft hidden and replaces each hit with a brief static burst at its original calendar position, followed by disappearance.`;
  if (!stationary) description = description
    .replace('lasting 12 seconds', `from ${timing.new.start} to ${timing.new.end} seconds, at twice its original speed`)
    .replace('Stars appear after 4.4 seconds', `Stars appear after ${timing.starsAt} seconds`)
    .replace('From 17.6 seconds', `From ${clock.after(horde.moveAt)} seconds`)
    .replace('from 13.2 to 17.4 seconds', `from ${clock.after(ship.enterAt)} to ${clock.after(canonicalGameplay.startAt)} seconds`);
  if (!stationary) {
    description += ' After every invader and its explosion have disappeared, large pixel-art lettering reading GITHUB SAVED! fades in at the centre of the starfield. After one second fully visible, the entire scene fades out together, resets while completely hidden against the existing theme background, and fades in the exact initial contribution graph. The approved timeline then restarts. Reduced motion uses the same simple opacity transition.';
    body = wrapSimpleReset(body, reset, plans, clock, gameplay);
  }
  return svg(graph.width, graph.height, 'Contribution Graph → Invaders — Daniel Rabottini', body, theme, description)
    .replace('viewBox="0 0 880 192"', `viewBox="${graph.viewBox}"`);
}
