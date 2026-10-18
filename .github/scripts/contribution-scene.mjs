import { normalizeCalendar } from './contribution-calendar.mjs';
import { canvas, invaderGeometry } from './motion-geometry.mjs';

export const invadersName = (theme, mobile = false, stationary = false) => `contribution-invaders${mobile ? '-mobile' : ''}${stationary ? '-static' : ''}-${theme}.svg`;

// Recovered from the previous snake SVGs, including their original viewBox.
export const graph = Object.freeze({ width: canvas.width, height: canvas.height, viewBox: `${canvas.left} ${canvas.top} ${canvas.width} ${canvas.height}`, size: invaderGeometry.size, step: 16, radius: 2 });
export const contributionColors = {
  dark: ['#19232d', '#20443d', '#2f7564', '#49ad92', '#75e0ca'],
  light: ['#e5edf0', '#bfd9d1', '#7bbba8', '#308f76', '#096e5b'],
};
export const sequence = Object.freeze({ duration: 12, hold: 2.4, wave: 4, morph: 4.4, starsAt: 4.4, starsFade: 7.2, farPeriod: 55 / 1.5 / 1.30, nearPeriod: 33 / 1.5 / 1.30 });

export function layoutCalendar(input, mobile = false) {
  const calendar = normalizeCalendar(input);
  const first = Date.parse(calendar.days[0].date);
  const sunday = first - new Date(first).getUTCDay() * 86_400_000;
  // Mobile intentionally keeps the original geometry: no folding or reordering.
  return calendar.days.map((day) => {
    const week = Math.floor((Date.parse(day.date) - sunday) / (7 * 86_400_000));
    const row = new Date(day.date).getUTCDay();
    return { ...day, week, row, x: 2 + week * graph.step, y: 2 + row * graph.step };
  });
}
