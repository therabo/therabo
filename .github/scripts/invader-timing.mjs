import {sequence} from './contribution-scene.mjs';
import {randomFor} from './random.mjs';
import { horde } from './horde.mjs';
import { ship } from './ship.mjs';

const round=n=>Number(n.toFixed(6));

// This clock belongs only to the active-contribution scene. The empty calendar
// and Meteor Dodge retain their original shared sequence and ship clocks.
export function invaderMorphTiming(cells,configuration) {
  const weeks=Math.max(1,...cells.map(c=>c.week));
  const selected=configuration.selectedDates?new Set(configuration.selectedDates):null;
  const oldDelay=c=>Number((sequence.hold+sequence.wave*c.week/weeks).toFixed(4));
  const oldRetire=c=>round(sequence.starsAt+2.2*c.week/weeks+randomFor(configuration.seed+':retire:'+c.date)()*.5);
  const events=cells.filter(c=>c.count>0).map(c=>({start:!selected||selected.has(c.date)?oldDelay(c):oldRetire(c),duration:sequence.morph}));
  if(!events.length)throw new Error('An empty dataset has no block-to-invader morph.');
  const start=Math.min(...events.map(e=>e.start)),end=round(Math.max(...events.map(e=>e.start+e.duration)));
  const oldDuration=round(end-start),duration=oldDuration/2,timeSaved=oldDuration-duration;
  // Every event and its local duration use this same affine mapping, including
  // the staggered masks, rim, omitted-block fade, empty fade and starfield fade.
  const morphTime=time=>round(start+(time-start)/2);
  const after=time=>round(time-timeSaved);
  return {
    old:{start,end,duration:oldDuration},new:{start,end:round(start+duration),duration},
    speedMultiplier:2,timeSaved,cellDuration:sequence.morph/2,
    starsAt:morphTime(sequence.starsAt),starsFade:sequence.starsFade/2,
    oldDelay,oldRetire,delay:c=>morphTime(oldDelay(c)),retire:c=>morphTime(oldRetire(c)),morphTime,after,
  };
}

// Compile gameplay on its approved clock first, then translate all event times.
// This preserves the exact target order, intercepts, manoeuvres and hit cadence.
export function shiftGameplayTimeline(timeline,offset) {
  return {...timeline,startAt:timeline.startAt-offset,completeAt:timeline.completeAt-offset,
    moves:timeline.moves.map(m=>({...m,startAt:m.startAt-offset,endAt:m.endAt-offset})),
    shots:timeline.shots.map(s=>({...s,selectedAt:s.selectedAt-offset,fireAt:s.fireAt-offset,hitAt:s.hitAt-offset,destroyedAt:s.destroyedAt-offset})),
  };
}

// Only the positioning interval is sped up. Canonical gameplay and individual
// motion keep their approved relative phases and durations.
const invaderPositioningSpeed = 1.60;
const invaderPrePositioningGapFraction = .40;
export function invaderPositioningTiming(morph) {
  const start = horde.settleAt, end = start + horde.settleDuration;
  const duration = horde.settleDuration / invaderPositioningSpeed;
  const timeSaved = round(horde.settleDuration - duration);
  const positionedTime = time => morph.after(time <= start ? time : time < end
    ? start + (time - start) / invaderPositioningSpeed : time - timeSaved);
  const oldGap = round(morph.after(start) - morph.new.end);
  const newGap = round(oldGap * invaderPrePositioningGapFraction);
  const gap = { oldDuration: oldGap, newDuration: newGap,
    retainedFraction: invaderPrePositioningGapFraction, timeSaved: round(oldGap - newGap) };
  // Morph and star fade retain their own clocks. Only the intentional hold is
  // compressed; positioning and every later event are translated, not sped up.
  const after = time => time <= morph.old.end ? positionedTime(time) : time < start
    ? round(morph.new.end + (time - morph.old.end) * invaderPrePositioningGapFraction)
    : round(positionedTime(time) - gap.timeSaved);
  const range = (start, end) => ({ start, end, duration: round(end - start) });
  return {
    speedMultiplier: invaderPositioningSpeed, timeSaved, gap,
    timelineOffset: round(morph.timeSaved + timeSaved + gap.timeSaved),
    old: { deployment: range(morph.after(start), morph.after(end)),
      ship: range(morph.after(ship.enterAt), morph.after(ship.enterAt + ship.duration)),
      offset: round(ship.enterAt - start), gameplayAt: morph.after(end) },
    new: { deployment: range(after(start), after(end)),
      ship: range(after(ship.enterAt), after(ship.enterAt + ship.duration)),
      offset: round((ship.enterAt - start) / invaderPositioningSpeed), gameplayAt: after(end) },
    after,
  };
}
