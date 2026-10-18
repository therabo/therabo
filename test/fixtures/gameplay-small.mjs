// Controlled preview/test only. Production still uses the approved horde plans.
export const smallGameplayPlans = [
  [200, 120], [300, 56], [250, 112], [400, 20],
].map(([x, y], i) => ({
  date: `2026-01-0${i + 1}`, id: `horde-2026-01-0${i + 1}`,
  finalX: x, finalY: y, scale: 1, startAt: 17.6, period: 40,
  points: [0, 100].map(percent => ({ percent, x: 0, y: 0, ease: [.3, 0, .7, 1] })),
}));
