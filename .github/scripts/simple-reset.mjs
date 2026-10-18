import { horde } from './horde.mjs';
import { ship } from './ship.mjs';
import { explosion } from './hit-explosion.mjs';

// Invader-only native replay, without changing the original scene. See ADR-0004.
// Keep SMIL syncbase IDs free of hyphens: Gecko drops later .end intervals.
const fadeSignal = 'invader_scene_fade';
const resetSignal = 'invader_scene_reset';
export const simpleReset = Object.freeze({
  victoryHold: 1, fadeOut: .5, hiddenHold: .15, fadeIn: .5, resetPulse: .08,
});
const round = n => Number(n.toFixed(6));

export function planSimpleReset(ending) {
  if (!ending) return null;
  const c = simpleReset;
  const startAt = round(ending.appearsAt + ending.fadeDuration + c.victoryHold);
  const hiddenAt = round(startAt + c.fadeOut);
  const fadeInAt = round(hiddenAt + c.hiddenHold);
  const period = round(fadeInAt + c.fadeIn);
  const resetAt = round(hiddenAt + (c.hiddenHold - c.resetPulse) / 2);
  const resetEnd = round(resetAt + c.resetPulse);
  return { startAt, hiddenAt, fadeInAt, period, resetAt, resetEnd,
    replayWait: round(period - resetEnd), totalDuration: round(period - startAt),
    victoryHold: c.victoryHold, fadeOutDuration: c.fadeOut,
    hiddenHold: c.hiddenHold, fadeInDuration: c.fadeIn };
}

function replayStyles(plan, plans, timing, gameplay) {
  const wait = plan.replayWait;
  const delay = (selectors, value) => selectors.split(',').map(s => `.invader-replay ${s}`).join(',') +
    `{animation-delay:${value}!important}`;
  return `<style>
/* Replay only offsets delays; keyframes, paths, durations and easing stay intact. */
${delay('.eye,.notch,.active,.empty', `calc(var(--delay) + ${wait}s)`)}
${delay('.omitted', `calc(var(--retire-delay) + ${wait}s)`)}
${delay('.deploy', `${round(timing.after(horde.settleAt) + wait)}s`)}
${plans.map(p => delay(`[data-motion="${p.id}"]`, `${round(timing.after(p.startAt) + wait)}s`)).join('\n')}
${delay('.far,.near', `${wait}s`)}
${delay('.ship-entry,.ship-engine-trail', `${round(timing.after(ship.enterAt) + wait)}s,${round(gameplay.startAt + wait)}s`)}
${delay('.space', `${round(timing.starsAt + wait)}s`)}
${delay('.target-life,.hit-explosion,.explosion-flash', `calc(var(--hit-at) + ${wait}s)`)}
${delay('.explosion-rays', `calc(var(--hit-at) + ${round(explosion.burstStart + wait)}s)`)}
${delay('.explosion-fragment', `calc(var(--hit-at) + ${round(explosion.fragmentStart + wait)}s)`)}
${delay('.projectile', `calc(var(--fire-at) + ${wait}s)`)}
${delay('.invader-gameplay', `calc(var(--cleanup-at) + ${wait}s)`)}
${delay('.invader-victory', `calc(var(--victory-at) + ${wait}s)`)}
.invader-resetting,.invader-resetting *{animation-name:none!important}
</style>`;
}

export function wrapSimpleReset(body, plan, plans, timing, gameplay) {
  if (!plan) return body;
  const c = simpleReset;
  const keyTimes = [0, c.fadeOut / plan.totalDuration,
    (c.fadeOut + c.hiddenHold) / plan.totalDuration, 1].map(n => Number(n.toFixed(9))).join(';');
  const opacity = `<animate id="${fadeSignal}" attributeName="opacity" values="1;0;0;1" keyTimes="${keyTimes}" calcMode="spline" keySplines=".42 0 .58 1;0 0 1 1;.42 0 .58 1" begin="${plan.startAt}s;${fadeSignal}.end+${round(plan.period - plan.totalDuration)}s" dur="${plan.totalDuration}s"/>`;
  const signals = `<set attributeName="class" to="invader-scene invader-replay" begin="${plan.resetAt}s" dur="indefinite"/>` +
    `<set id="${resetSignal}" attributeName="class" to="invader-scene invader-replay invader-resetting" begin="${plan.resetAt}s;${resetSignal}.end+${round(plan.period - c.resetPulse)}s" dur="${c.resetPulse}s"/>`;
  return `<g class="simple-reset-scene">${opacity}<g id="invader-scene" class="invader-scene">${signals}${body}</g></g>` +
    replayStyles(plan, plans, timing, gameplay);
}
