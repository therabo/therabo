import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contributionInvaders, sceneMode, createSceneConfiguration } from '../.github/scripts/invaders.mjs';
import { contributionInvaders as invaderScene } from '../.github/scripts/invader-scene.mjs';
import { createStarfield } from '../.github/scripts/space-visuals.mjs';
import { ship, shipPoseAt, shipTrail, shipTrailCurve, shipSafeVerticalRange } from '../.github/scripts/ship.mjs';
import { meteorStyles, meteorMarkup, meteorPositionAt, meteorRules, meteorShapes, createMeteorField, planMeteorDodges, certifyMeteorSafety, meteorOccurrences, projectedThreat } from '../.github/scripts/meteor-dodge.mjs';
import { canvas } from '../.github/scripts/motion-geometry.mjs';

const input={user:'therabo',days:Array.from({length:28},(_,i)=>({date:new Date(Date.UTC(2026,8,i+1)).toISOString().slice(0,10),count:0,level:0}))};
const field=createMeteorField({seed:'meteor-dodge-v2'});
const sky=createStarfield({seed:'shared-scene-starfield'});
const fixtureMeteor=(id,y,crossingAt,diameter=20)=>{
  const speed=80,startX=canvas.right+diameter/2+1;
  return {id,y,diameter,speed,startX,endX:canvas.left-diameter/2-1,spawnAt:crossingAt-(startX-meteorRules.shipX)/speed,angle:0,spin:10,shape:0};
};

test('empty initial dataset dispatches only to Meteor Dodge; variants share generation',()=>{
  assert.equal(sceneMode(input),'METEOR_DODGE');
  assert.deepEqual(createSceneConfiguration(input,{seed:'meteor-dodge-v2'}),field);
  for(const theme of ['dark','light'])for(const mobile of [false,true]){
    const asset=contributionInvaders(input,theme,mobile,false,field,sky);
    const data=JSON.parse(asset.match(/<metadata>(.*?)<\/metadata>/s)[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
    assert.equal(data.sceneMode,'METEOR_DODGE');assert.equal(data.initialActiveCells,0);
    assert.equal((asset.match(/class="meteor" /g)||[]).length,meteorRules.count);
    assert.equal((asset.match(/class="ship-engine-trail /g)||[]).length,3);
    assert.ok(!/class="(?:horde-invader|projectile|hit-explosion|target-life)"/.test(asset));
    assert.ok(!('gameplay' in data), 'No Invader shooting timeline in Meteor Mode');
    assert.ok(!/@keyframes carve|<script|foreignObject/.test(asset));
    assert.deepEqual(data.starfield,sky);assert.deepEqual(data.meteorField,field);
    assert.equal((asset.match(/data-count="0"/g)||[]).length,28);
    assert.match(asset,/\.meteor-static\{display:block\}/);assert.match(asset,/transform:translate\(424px,64px\)!important/);
    const stationary=contributionInvaders(input,theme,mobile,true,field,sky);
    assert.ok(!stationary.includes('<metadata>'));assert.ok(!stationary.includes('class="ship"'));
  }
});

test('real39 stays in Invader Mode, independently of its finished gameplay',async()=>{
  const active=JSON.parse(await readFile(new URL('../assets/contributions/calendar.json',import.meta.url)));
  assert.equal(active.days.filter(d=>d.count>0).length,39);
  assert.equal(sceneMode(active),'INVADERS');
  const configuration=createSceneConfiguration(active,{seed:'0375e116b1f14dcf318f471fb442383a'});
  const rendered=contributionInvaders(active,'dark',false,false,configuration,sky);
  assert.equal(rendered,invaderScene(active,'dark',false,false,configuration,sky));
  assert.ok(!rendered.includes('METEOR_DODGE'));
  assert.equal((rendered.match(/class="projectile"/g)||[]).length,39);
});

test('three-meteor fixture: harmless ignored, then UP and DOWN',()=>{
  const t=meteorRules.startAt;
  const meteors=[fixtureMeteor('harmless',-10,t+3),fixtureMeteor('up',80,t+8),fixtureMeteor('down',12,t+13)];
  const result=planMeteorDodges(meteors);
  assert.ok(result.safe);assert.deepEqual(result.timeline.decisions.map(d=>d.direction),['IGNORE','UP','DOWN']);
  assert.equal(result.timeline.moves.length,2);assert.ok(result.certificate.minimumClearance>=meteorRules.safety);
});

test('paired threat changes escape from UP to DOWN after considering both projections',()=>{
  const t=meteorRules.startAt+9;
  const first=fixtureMeteor('primary',80,t),second=fixtureMeteor('upper-blocker',10,t+.16);
  assert.equal(planMeteorDodges([first]).timeline.decisions[0].direction,'UP');
  const result=planMeteorDodges([first,second]);assert.ok(result.safe);
  assert.equal(result.timeline.decisions[0].direction,'DOWN');
  assert.deepEqual(result.timeline.decisions[0].considered,['primary','upper-blocker']);
  assert.ok(certifyMeteorSafety([first,second],result.timeline).safe);
});

test('complete meteor sequence has continuous hull safety, bounded population and seamless trails',()=>{
  assert.equal(meteorShapes.length,9);assert.equal(field.meteors.length,meteorRules.count);assert.ok(field.maxVisible<=7);
  assert.equal(field.timeline.flight.finalX,(canvas.left+canvas.right)/2);
  const end=field.timeline.flight.repeatAt+field.period,occurrences=meteorOccurrences(field,end);
  const certificate=certifyMeteorSafety(occurrences,field.timeline,meteorRules.startAt,end);
  assert.ok(certificate.safe);assert.equal(certificate.collisions.length,0);assert.ok(certificate.minimumClearance>=meteorRules.safety);
  for(const m of field.meteors){assert.ok(m.startX>canvas.right+m.diameter/2);assert.ok(m.endX<canvas.left-m.diameter/2);assert.ok(m.speed>=58 && m.speed<=88);assert.ok(m.diameter>=12 && m.diameter<=30);assert.ok(projectedThreat(m).startAt>meteorRules.startAt);}
  const {repeatAt}=field.timeline.flight;
  assert.deepEqual(shipPoseAt(repeatAt,field.timeline),shipPoseAt(end,field.timeline));
  for(const w of shipTrail)assert.deepEqual(shipTrailCurve(w,repeatAt,field.timeline),shipTrailCurve(w,end,field.timeline));
  for(const move of field.timeline.moves){
    assert.ok(move.fromY>=shipSafeVerticalRange.top && move.fromY<=shipSafeVerticalRange.bottom);
    assert.ok(move.toY>=shipSafeVerticalRange.top && move.toY<=shipSafeVerticalRange.bottom);
    for(let i=0;i<=48;i++){
      const time=move.startAt+(move.endAt-move.startAt)*i/48,pose=shipPoseAt(time,field.timeline);
      assert.ok(pose.y-ship.height/2>=canvas.top && pose.y+ship.height/2<=canvas.bottom);
      for(const w of shipTrail){const c=shipTrailCurve(w,time,field.timeline);for(const p of [c.start,c.c1,c.c2,c.end])assert.ok(pose.y+p.y-w.strokeWidth/2>=canvas.top && pose.y+p.y+w.strokeWidth/2<=canvas.bottom);}
    }
  }
});

test('meteor module has no invader/shooting dependency',async()=>{
  for(const file of ['meteor-dodge.mjs','meteor-scene.mjs']){
    const source=await readFile(new URL('../.github/scripts/'+file,import.meta.url),'utf8');
    assert.ok(!/from ['"].*(?:gameplay|hit-explosion|horde|invader-scene)/.test(source));
  }
});

test('harmless meteors above/below remain in the SVG and cross completely; only C requires a dodge',()=>{
  const t=meteorRules.startAt;
  const meteors=[fixtureMeteor('A-above',-10,t+4),fixtureMeteor('B-below',140,t+6),fixtureMeteor('C-threat',64,t+12)];
  for(const m of meteors)m.travelDuration=(m.startX-m.endX)/m.speed;
  const original=structuredClone(meteors),result=planMeteorDodges(meteors);
  assert.ok(result.safe);assert.deepEqual(meteors,original);
  assert.ok(result.timeline.decisions.filter(d=>d.direction==='IGNORE').flatMap(d=>d.considered).includes('A-above'));
  assert.ok(result.timeline.decisions.filter(d=>d.direction==='IGNORE').flatMap(d=>d.considered).includes('B-below'));
  assert.equal(result.timeline.moves.length,1);
  assert.ok(result.timeline.decisions.find(d=>d.threats.includes('C-threat')).direction!=='IGNORE');
  const markup=meteorMarkup({meteors,period:meteorRules.period});
  for(const m of meteors){
    assert.ok(markup.includes(`data-meteor="${m.id}"`));
    assert.ok(meteorPositionAt(m,m.spawnAt).x>canvas.right);
    const mid=meteorPositionAt(m,m.spawnAt+m.travelDuration/2);assert.ok(mid.x>canvas.left&&mid.x<canvas.right);
    assert.ok(meteorPositionAt(m,m.spawnAt+m.travelDuration).x<canvas.left);
  }
});

test('definitive v2 samples independently of ship and emits script-free repeating SVG motion',async()=>{
  assert.equal(meteorRules.period,300);assert.equal(meteorRules.count,108);
  const source=await readFile(new URL('../.github/scripts/meteor-dodge.mjs',import.meta.url),'utf8');
  const generator=source.slice(source.indexOf('export function createMeteorField'),source.indexOf('export function meteorShapeMarkup'));
  assert.doesNotMatch(generator,/shipPoseAt|predicted|previous|crypto\.getRandomValues/);
  assert.match(generator,/y:round\(canvas\.top\+radius\+3\+random\(\)/);
  const asset=contributionInvaders(input,'dark',false,false,field,sky);
  assert.doesNotMatch(asset,/<script|foreignObject|javascript:|onload=|Web Crypto|runtime-meteor/);
  assert.ok(!('completeAt'in field.timeline));
  assert.equal((meteorMarkup(field).match(/s infinite/g)||[]).length,field.meteors.length*2);
});


test('perpetual traffic and evasions continue across distant periods, with no terminal state',()=>{
  assert.equal(field.perpetual,true);
  assert.equal('completeAt' in field.timeline,false);
  assert.equal('endAt' in field,false);
  const {repeatAt,period}=field.timeline.flight;
  assert.ok(period>72);
  const loopMoves=field.timeline.moves.filter(m=>m.startAt>=repeatAt);
  assert.ok(loopMoves.length/period>4/72,'Evasion cadence exceeds the approved baseline');
  for(const periods of [1,7,10000]) {
    const offset=loopMoves[0].startAt-repeatAt+.2;
    const pose=shipPoseAt(repeatAt+period*periods+offset,field.timeline);
    const reference=shipPoseAt(repeatAt+offset,field.timeline);
    assert.ok(Math.hypot(pose.x-reference.x,pose.y-reference.y)<1e-6);
    for(const engine of shipTrail) {
      const a=shipTrailCurve(engine,repeatAt+period*periods+offset,field.timeline);
      const b=shipTrailCurve(engine,repeatAt+offset,field.timeline);
      for(const point of ['start','c1','c2','end'])assert.ok(Math.hypot(a[point].x-b[point].x,a[point].y-b[point].y)<.00001);
    }
  }
  const markup=meteorMarkup(field);
  assert.equal((markup.match(/s infinite/g)||[]).length,field.meteors.length*2);
  assert.equal((meteorStyles(field).match(/@keyframes travel-/g)||[]).length,field.meteors.length);
  assert.equal(new Set(field.meteors.filter(m=>m.kind!=='small').map(m=>m.shape)).size,9);
});
