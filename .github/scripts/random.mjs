import { createHash } from 'node:crypto';

// Seed hashes are part of the approved geometry contract. Layout/space use SHA;
// individual invader motion uses FNV. Never merge the two seed mappings.
function stream(state) {
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const randomFor = seed => stream(createHash('sha256').update(seed).digest().readUInt32LE());

export function motionRandomFor(key) {
  let state = 2166136261;
  for (const c of key) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  return stream(state);
}
