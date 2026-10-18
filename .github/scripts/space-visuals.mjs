import { randomBytes } from 'node:crypto';
import { canvas } from './motion-geometry.mjs';
import { randomFor } from './random.mjs';

// Visuals only: no gameplay dimensions, alignment, timing or trajectory inputs.
export const projectileVisual = Object.freeze({ length: 14.4, thickness: 3.6, color: '#ffffff' });
// Mirror the approved droplet within its bounding box and scale both axes 2×.
// The full round head now faces right; its leading point remains (0,0), preserving
// the logical launch/intercept. The pointed tail extends left to x=-14.4.
export const projectileShape = 'M-14.4 0C-10.4-.36-5-1.8-1.8-1.8C.6-1.8.6 1.8-1.8 1.8C-5 1.8-10.4.36-14.4 0Z';

function starShape(type, bold = false) {
  switch (type) {
    case 'dot': return `<circle r="${bold ? 1 : .8}"/>`;
    case 'bright': return '<rect x="-.65" y="-.65" width="1.3" height="1.3" rx=".12"/>';
    case 'diamond': return bold ? '<path d="M0-1.4 1.12 0 0 1.4-1.12 0Z"/>' : '<path d="M0-1.3.9 0 0 1.3-.9 0Z"/>';
    case 'cross': return bold ? '<path d="M-.4-1.7h.8v1.3h1.3v.8H.4v1.3h-.8V.4h-1.3v-.8h1.3Z"/>' : '<path d="M-.27-1.65h.54v1.38h1.38v.54H.27v1.38h-.54V.27h-1.38v-.54h1.38Z"/>';
    case 'sparkle': return '<path d="M0-2C.22-.48.48-.22 1.8 0 .48.22.22.48 0 2-.22.48-.48.22-1.8 0-.48-.22-.22-.48 0-2Z"/>';
    default: throw new Error(`Unknown star variant: ${type}`);
  }
}

function starExtent(star) {
  const extent = star.bold ? { dot: 1, diamond: 1.4, cross: 1.7 } : { dot: .8, bright: Math.SQRT2 * .65, diamond: 1.3, cross: 1.65, sparkle: 2 };
  return extent[star.type] * star.scale;
}
const round = n => Number(n.toFixed(6));
// Binary subpixel positions keep tiled paint coordinates exact through ±880.
const coordinate = n => Math.round(n * 256) / 256;
const wrappedX = x => canvas.left + ((x - canvas.left) % canvas.width + canvas.width) % canvas.width;
const distance = (a, b) => Math.hypot(Math.min(Math.abs(a.x - b.x), canvas.width - Math.abs(a.x - b.x)), a.y - b.y);

// Fresh entropy for EACH asset generation. Retain the complete sampled layout,
// then pass this one immutable configuration to every theme/mobile renderer.
export function createStarfield({ seed = randomBytes(16).toString('hex') } = {}) {
  const random = randomFor(`retro-starfield:${seed}`), between = (a, b) => a + random() * (b - a);
  const pick = values => values[Math.floor(random() * values.length)];
  const shuffle = values => {
    for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
    return values;
  };
  const layer = near => {
    const count = near ? 20 : 46, boldCount = near ? 4 : 5, sparkleCount = near ? 1 : 2;
    const normalTypes = ['dot', 'bright', 'diamond', 'cross'];
    const descriptors = Array.from({ length: count - boldCount - sparkleCount }, (_, i) => ({
      type: i < normalTypes.length ? normalTypes[i] : pick(['dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'bright', 'bright', 'diamond', 'cross']), bold: false,
    }));
    for (let i = 0; i < boldCount; i++) descriptors.push({ type: i < 3 ? ['dot', 'diamond', 'cross'][i] : pick(['dot', 'diamond', 'cross']), bold: true });
    for (let i = 0; i < sparkleCount; i++) descriptors.push({ type: 'sparkle', bold: false });
    const stars = [];
    for (const descriptor of shuffle(descriptors)) {
      const { type, bold } = descriptor;
      const scale = round(bold ? (near ? between(1.12, 1.36) : between(.84, 1.08)) : (near ? between(.9, 1.2) : between(.6, .9)));
      const brightness = round(bold ? between(.9, 1) : type === 'sparkle' ? between(.86, 1) : between(.62, .94));
      const star = { type, bold, scale, brightness, color: near ? (random() < .2 ? 'accent' : 'text') : 'muted' };
      const radius = starExtent(star), guard = .4;
      let placed = false;
      for (let attempt = 0; attempt < 1000; attempt++) {
        // Mostly unrestricted random positions, plus a few loose micro-clusters.
        // Toroidal separation treats the tile seam exactly like its interior.
        const base = stars.length && random() < .2 ? pick(stars) : null;
        const angle = between(0, Math.PI * 2), offset = between(12, 28);
        const point = base ? { x: wrappedX(base.x + Math.cos(angle) * offset), y: base.y + Math.sin(angle) * offset } : { x: between(canvas.left, canvas.right), y: between(canvas.top + radius + guard, canvas.bottom - radius - guard) };
        point.x = wrappedX(coordinate(point.x)); point.y = coordinate(point.y);
        if (point.y - radius < canvas.top + guard || point.y + radius > canvas.bottom - guard) continue;
        if (stars.some(other => distance(point, other) < radius + starExtent(other) + 4 || (bold && other.bold && distance(point, other) < 30))) continue;
        if (stars.filter(other => distance(point, other) < 30).length > 2) continue;
        stars.push(Object.freeze({ ...star, x: point.x, y: point.y })); placed = true; break;
      }
      if (!placed) throw new Error('Unable to place a safe random star');
    }
    return Object.freeze(stars);
  };
  return Object.freeze({ version: 2, seed, far: layer(false), near: layer(true) });
}

function starSpecs(near, configuration) {
  if (!configuration) throw new Error('Share one generated starfield across all asset variants');
  return near ? configuration.near : configuration.far;
}

export function starLayer(near, theme, configuration) {
  const opacity = theme === 'dark' ? (near ? .46 : .34) : (near ? .34 : .24);
  const stars = starSpecs(near, configuration).map(s => `<g data-star="${s.type}" data-bold="${s.bold}" transform="translate(${s.x} ${s.y}) scale(${s.scale})" fill="${s.color}" opacity="${s.brightness}">${starShape(s.type, s.bold)}</g>`).join('');
  // Guard tiles on BOTH ends also retain stars whose silhouettes straddle a seam.
  // Throughout translateX(0..-880), the visible field has complete periodic cover.
  const tiles = [-1, 0, 1, 2].map(tile => `<g data-star-tile="${tile}" transform="translate(${tile * canvas.width} 0)">${stars}</g>`).join('');
  return `<g class="${near ? 'near' : 'far'}" opacity="${opacity}">${tiles}</g>`;
}
