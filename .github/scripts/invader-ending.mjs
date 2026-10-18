import { canvas } from './motion-geometry.mjs';

export const invaderEnding = Object.freeze({
  message: 'GITHUB SAVED!',
  cleanupDelay: .04,
  settleDelay: .12,
  fadeDuration: .32,
  pixelSize: 8,
  shadowOffset: 4,
  centerX: canvas.left + canvas.width / 2,
  centerY: canvas.top + canvas.height / 2,
});
const round = n => Number(n.toFixed(6));

// The last fired shot need not be the last impact. Wait for every destruction,
// including its entire burst, and never create a victory for an empty timeline.
export function planInvaderEnding(timeline) {
  if (!timeline?.shots?.length) return null;
  const allDestroyedAt = Math.max(timeline.completeAt, ...timeline.shots.map(s => s.destroyedAt));
  return { message: invaderEnding.message, destroyed: timeline.shots.length, allDestroyedAt,
    cleanupAt: round(allDestroyedAt + invaderEnding.cleanupDelay),
    appearsAt: round(allDestroyedAt + invaderEnding.settleDelay),
    fadeDuration: invaderEnding.fadeDuration };
}

// Fixed 5×7 bitmap lettering, encoded as SVG geometry. No font dependency,
// raster image, filter or script is needed when GitHub displays the SVG.
const glyphs = {
  G: ['01110','10001','10000','10111','10001','10001','01110'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  '!': ['1','1','1','1','1','0','1'],
};

export const victoryLettering = (() => {
  let x = 0; const paths = [];
  for (const char of invaderEnding.message) {
    if (char === ' ') { x += 4; continue; }
    const rows = glyphs[char];
    rows.forEach((row, y) => {
      for (const run of row.matchAll(/1+/g)) paths.push(`M${x + run.index} ${y}h${run[0].length}v1h-${run[0].length}z`);
    });
    x += rows[0].length + 1;
  }
  const width = (x - 1) * invaderEnding.pixelSize, height = 7 * invaderEnding.pixelSize;
  return Object.freeze({ d: paths.join(''), width, height,
    x: invaderEnding.centerX - (width + invaderEnding.shadowOffset) / 2,
    y: invaderEnding.centerY - (height + invaderEnding.shadowOffset) / 2 });
})();

export function invaderEndingMarkup(ending) {
  if (!ending) return '';
  const { x, y, d } = victoryLettering, { pixelSize, shadowOffset } = invaderEnding;
  return `<g class="invader-victory" role="img" aria-label="${invaderEnding.message}" style="--victory-at:${ending.appearsAt}s" shape-rendering="crispEdges"><g transform="translate(${x} ${y})"><path fill="accent" transform="translate(${shadowOffset} ${shadowOffset}) scale(${pixelSize})" d="${d}"/><path fill="text" transform="scale(${pixelSize})" d="${d}"/></g></g>`;
}

export function invaderEndingStyles() {
  return `.invader-gameplay{animation:ending-cleanup .001s steps(1,end) var(--cleanup-at) 1 forwards}
@keyframes ending-cleanup{to{visibility:hidden}}
.invader-victory{visibility:hidden;opacity:0;pointer-events:none;animation:victory-reveal ${invaderEnding.fadeDuration}s ease-out var(--victory-at) 1 forwards}
@keyframes victory-reveal{from{visibility:visible;opacity:0}to{visibility:visible;opacity:1}}
@media(prefers-reduced-motion:reduce){.invader-victory{animation-duration:.001s;animation-timing-function:steps(1,end)}}`;
}
