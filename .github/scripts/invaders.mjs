// Dataset selection is the only mode boundary; finishing gameplay cannot change it.
// See ADR-0002. The approved renderer stays isolated in invader-scene.mjs.
import { normalizeCalendar } from './contribution-calendar.mjs';
import { contributionInvaders as invaderScene } from './invader-scene.mjs';
import { meteorScene } from './meteor-scene.mjs';
import { createMeteorField } from './meteor-dodge.mjs';
import { createDeployment } from './organic-deployment.mjs';
import { layoutCalendar } from './contribution-scene.mjs';
export { graph, contributionColors, sequence, layoutCalendar, invadersName } from './contribution-scene.mjs';

const sceneModes = Object.freeze({ INVADERS: 'INVADERS', METEOR_DODGE: 'METEOR_DODGE' });
export const sceneMode = calendar => calendar.days.some(day => day.count > 0) ? sceneModes.INVADERS : sceneModes.METEOR_DODGE;

export function createSceneConfiguration(input, options = {}) {
  const calendar = normalizeCalendar(input);
  return sceneMode(calendar) === sceneModes.METEOR_DODGE
    ? createMeteorField(options) : createDeployment(layoutCalendar(calendar), options);
}

export function contributionInvaders(input, theme = 'dark', mobile = false, stationary = false, configuration, starfield) {
  const calendar = normalizeCalendar(input);
  if (!stationary && sceneMode(calendar) === sceneModes.METEOR_DODGE) {
    return meteorScene(calendar, theme, mobile, configuration?.sceneMode === sceneModes.METEOR_DODGE ? configuration : createMeteorField(), starfield);
  }
  return invaderScene(calendar, theme, mobile, stationary, configuration, starfield);
}
