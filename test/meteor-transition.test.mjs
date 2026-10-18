import test from 'node:test';
import assert from 'node:assert/strict';
import { meteorScene, meteorTransition } from '../.github/scripts/meteor-scene.mjs';
import { createMeteorField, meteorRules, meteorMarkup, meteorStyles, meteorOccurrences, certifyMeteorSafety, meteorPositionAt } from '../.github/scripts/meteor-dodge.mjs';
import { createStarfield } from '../.github/scripts/space-visuals.mjs';
import { shipStyles, ship } from '../.github/scripts/ship.mjs';

const calendar={user:'therabo',days:Array.from({length:56},(_,i)=>({date:new Date(Date.UTC(2026,7,2+i)).toISOString().slice(0,10),count:0,level:0}))};
const field=createMeteorField({seed:'7136b2083363708dd6235357ac8eff23'});
const sky=createStarfield({seed:'unified-transition-test'});
const rendered=meteorScene(calendar,'dark',false,field,sky);
const data=JSON.parse(rendered.match(/<metadata>(.*?)<\/metadata>/s)[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
const offset=data.transition.timeOffset;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} ≠ ${b}`);

test('empty graph, starfield, ship and gameplay use the approved unified intro boundaries',()=>{
  assert.deepEqual(meteorTransition,{graphAt:2.6308,graphEnd:6.7154,starsAt:3.5154,starsEnd:7.1154,gameplayAt:13.3154});
  const delays=[...rendered.matchAll(/class="empty" style="--delay:([\d.]+)s"/g)].map(m=>Number(m[1]));
  near(Math.min(...delays),2.6308);
  near(Math.max(...delays)+data.transition.graphCellDuration,6.7154);
  assert.match(rendered,/animation:space-in 3\.6s ease-in-out 3\.5154s/);
  assert.match(rendered,/meteor-ship-entry 4\.2s linear 9\.1154s 1 both/);
  assert.match(rendered,/meteor-ship-intro 300s linear 13\.3154s 1 forwards/);
  near(9.1154+ship.duration,13.3154);
  near(6.7154+2.2,8.9154);
  assert.equal(offset,4.0846);
  assert.deepEqual(data.starfield,sky);
});

test('translate the v2 field clock only: same schedule, geometry, spin and ship/trail keyframes',()=>{
  const before=structuredClone(field),old=meteorMarkup(field),next=meteorMarkup(field,'dark',offset);
  // All keyframe blocks remain identical; only animation declarations change.
  const frames=s=>[...s.matchAll(/@keyframes [^@]+/g)].map(m=>m[0].split(/\n\.[\w-]+\{/)[0]);
  assert.deepEqual(frames(shipStyles(field.timeline)),frames(shipStyles(field.timeline,offset)));
  assert.ok(rendered.includes(meteorStyles(field)));
  assert.deepEqual(data.meteorField,field);
  assert.equal(field.period,300);assert.equal(field.meteors.length,108);
  for(const meteor of field.meteors){
    assert.ok(next.includes(`travel-${meteor.id} 300s linear ${Number((meteor.spawnAt-offset).toFixed(6))}s infinite`));
    assert.ok(next.includes(`spin-${meteor.id} 300s linear ${Number((meteor.spawnAt-offset).toFixed(6))}s infinite`));
    assert.ok(old.includes(`linear ${meteor.spawnAt}s infinite`));
    const shifted={...meteor,spawnAt:meteor.spawnAt-offset};
    const oldPose=meteorPositionAt(meteor,meteor.spawnAt+3),newPose=meteorPositionAt(shifted,meteor.spawnAt+3-offset);
    for(const axis of ['x','y','angle'])near(newPose[axis],oldPose[axis]);
  }
  assert.deepEqual(field,before);
  assert.doesNotMatch(rendered,/<script|foreignObject|NaN|undefined/);
});

test('no meteors or evasions before gameplay; translated field retains its continuous safety certificate',()=>{
  for(const meteor of field.meteors)assert.ok(meteor.spawnAt-offset>=meteorTransition.gameplayAt);
  for(const move of field.timeline.moves)assert.ok(move.startAt-offset>=meteorTransition.gameplayAt);
  assert.ok(rendered.includes('style="opacity:0;animation:travel-'));
  const end=field.timeline.flight.repeatAt+field.period;
  const certificate=certifyMeteorSafety(meteorOccurrences(field,end),field.timeline,meteorRules.startAt,end);
  assert.equal(certificate.collisions.length,0);assert.ok(certificate.safe);
  assert.ok(certificate.minimumClearance>=meteorRules.safety);
  assert.match(rendered,/meteor-ship-loop 300s linear 313\.3154s infinite/);
  assert.ok(field.perpetual);assert.ok(!('completeAt' in field.timeline));
});
