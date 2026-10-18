import { svg, escapeXml } from './graphics.mjs';
import { graph, contributionColors, sequence, layoutCalendar } from './contribution-scene.mjs';
import { invaderGeometry } from './motion-geometry.mjs';
import { ship, shipMarkup, shipStyles } from './ship.mjs';
import { createStarfield, starLayer } from './space-visuals.mjs';
import { meteorRules, meteorStyles, meteorMarkup } from './meteor-dodge.mjs';

// The empty branch has no block morph. These approved intro boundaries match
// the current 2× Invader scene; the v2 field keeps its canonical planning clock.
export const meteorTransition = Object.freeze({
  graphAt: 2.6308, graphEnd: 6.7154,
  starsAt: 3.5154, starsEnd: 7.1154,
  gameplayAt: 13.3154,
});

// Separate scene renderer: no invader, deployment, targeting or projectile API.
export function meteorScene(calendar, theme, mobile, field, starfield) {
  const cells=layoutCalendar(calendar,mobile),sky=starfield||createStarfield();
  const weeks=Math.max(1,...cells.map(c=>c.week));
  const oldDelay=c=>Number((sequence.hold+sequence.wave*c.week/weeks).toFixed(4));
  const first=Math.min(...cells.map(oldDelay)),last=Math.max(...cells.map(oldDelay))+sequence.morph;
  // Retain the original left-to-right dissolve and quiet keyframes, fitting
  // the whole empty graph into the requested window rather than adding a morph.
  const scale=(meteorTransition.graphEnd-meteorTransition.graphAt)/(last-first);
  const delay=c=>meteorTransition.graphAt+(oldDelay(c)-first)*scale;
  const timeOffset=Number((meteorRules.startAt-meteorTransition.gameplayAt).toFixed(6));
  const transition={...meteorTransition,shipAt:Number((ship.enterAt-timeOffset).toFixed(6)),timeOffset,
    graphCellDuration:sequence.morph*scale,canonicalGameplayAt:meteorRules.startAt};
  const data={sceneMode:'METEOR_DODGE',initialActiveCells:0,displayedInvaders:0,transition,starfield:sky,meteorField:field};
  const styles=`<style>
.empty{animation:quiet ${transition.graphCellDuration}s ease var(--delay) 1 both}
@keyframes quiet{0%,20%{opacity:1}100%{opacity:0}}
.space{opacity:0;animation:space-in ${Number((meteorTransition.starsEnd-meteorTransition.starsAt).toFixed(6))}s ease-in-out ${meteorTransition.starsAt}s 1 both}
@keyframes space-in{from{opacity:0}to{opacity:1}}
.far{animation:parallax ${sequence.farPeriod}s linear infinite}.near{animation:parallax ${sequence.nearPeriod}s linear infinite}
@keyframes parallax{to{transform:translateX(-${graph.width}px)}}
${shipStyles(field.timeline,timeOffset)}
${meteorStyles(field)}
.meteor-static{display:none}
@media(prefers-reduced-motion:reduce){.empty{animation:none!important;opacity:1!important}.space{animation:none!important;opacity:0!important}.far,.near{animation:none!important;transform:none!important}.meteor-field{display:none!important}.meteor-static{display:block}.ship-entry{animation:none!important;opacity:1!important;transform:translate(${meteorRules.shipX}px,${ship.finalY}px)!important}}
</style>`;
  const original=cells.map(c=>`<rect data-date="${c.date}" data-count="0" data-level="0" x="${c.x}" y="${c.y}" width="${graph.size}" height="${graph.size}" rx="2" ry="2" fill="${contributionColors[theme][0]}" stroke="#1b1f230a" stroke-width="${invaderGeometry.strokeWidth}" shape-rendering="geometricPrecision" class="empty" style="--delay:${delay(c)}s"/>`).join('');
  const body=`<metadata>${escapeXml(JSON.stringify(data))}</metadata><defs><clipPath id="field"><rect x="-16" y="-32" width="880" height="192"/></clipPath></defs>${styles}<g class="space" clip-path="url(#field)">${starLayer(false,theme,sky)}${starLayer(true,theme,sky)}</g>${original}${meteorMarkup(field,theme,timeOffset)}${shipMarkup(theme,field.timeline)}`;
  return svg(graph.width,graph.height,'Zero Contributions — Meteor Dodge — Daniel Rabottini',body,theme,
    `The initial real GitHub calendar has zero active contribution cells. Empty squares dissolve from ${transition.graphAt} to ${transition.graphEnd} seconds into the unchanged parallax starfield, which fades in from ${transition.starsAt} to ${transition.starsEnd} seconds. The approved pixel spacecraft enters from the upper left from ${transition.shipAt} to ${transition.gameplayAt} seconds and flies at the geometric horizontal midpoint. Meteor gameplay begins at ${transition.gameplayAt} seconds; no meteors cross during entry. Irregular arcade meteors travel right to left. Generation-time projected envelope checks choose safe eased vertical evasions, considering nearby threats together; harmless meteors cause no movement. The unchanged 300-second repeating schedule follows the introduction. There are no invaders, projectiles, locks or explosions. Reduced motion keeps the original graph with a stable spacecraft and sparse static meteors; stars and rapid movements are hidden.`)
    .replace('viewBox="0 0 880 192"',`viewBox="${graph.viewBox}"`);
}
