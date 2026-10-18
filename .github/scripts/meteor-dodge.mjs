import { randomBytes } from 'node:crypto';
import { randomFor as seeded } from './random.mjs';
import { canvas } from './motion-geometry.mjs';
import { ship, shipSafeVerticalRange, shipPoseAt, shipTrail } from './ship.mjs';

// This scene owns its clock and planning. No targeting, shooting or horde imports.
// Rotating silhouettes fit in their circumscribed collision circles.
export const meteorRules = Object.freeze({
  shipX: (canvas.left + canvas.right) / 2,
  startAt: ship.enterAt + ship.duration,
  period: 300,
  count: 108,
  safety: 5,
  strokeWidth: .8,
  maxShipSpeed: 180,
  maxVisible: 7,
  maxLargeVisible: 2,
  reactionGuard: .25,
  groupGap: 1.95,
});
const shipTrailLags=shipTrail.map(w=>w.lag);
const round = n => Number(n.toFixed(6));
// Original six silhouettes plus three distinct medium/large shapes, all r<=1.
export const meteorShapes = Object.freeze([
  { points: [[-.9,-.3],[-.48,-.85],[.18,-.94],[.8,-.52],[.95,.12],[.4,.88],[-.3,.91],[-.62,.34]], craters: [[-.25,-.28,.21],[.33,.3,.13]] },
  { points: [[-.96,-.08],[-.62,-.72],[-.08,-.97],[.62,-.66],[.89,-.1],[.57,.18],[.64,.66],[-.12,.94],[-.73,.58]], craters: [[-.33,.22,.18],[.25,-.38,.16],[.2,.47,.09]] },
  { points: [[-.81,-.54],[-.15,-.94],[.58,-.72],[.93,-.13],[.69,.5],[.05,.97],[-.34,.49],[-.9,.3]], craters: [[-.23,-.22,.25],[.38,.2,.11]] },
  { points: [[-.91,-.38],[-.42,-.89],[.22,-.76],[.78,-.59],[.86,.28],[.3,.91],[-.54,.72]], craters: [[-.29,.18,.2],[.3,-.29,.18]] },
  { points: [[-.98,.03],[-.58,-.64],[-.09,-.96],[.39,-.48],[.86,-.21],[.74,.54],[.02,.91],[-.6,.65]], craters: [[-.3,-.24,.16],[.31,.24,.24],[.01,.58,.08]] },
  { points: [[-.87,-.38],[-.2,-.97],[.49,-.78],[.87,-.15],[.51,.29],[.4,.86],[-.32,.9],[-.79,.4]], craters: [[-.22,.21,.22],[.29,-.32,.12]] },
  // Broad paired lobes, with a conspicuous cleft in the right edge.
  { name:'Cleft', points:[[-.94,-.17],[-.64,-.71],[-.04,-.96],[.65,-.63],[.92,-.17],[.38,.02],[.81,.45],[.2,.94],[-.69,.57]], craters:[[-.38,-.18,.23],[.03,.47,.18],[.3,-.43,.11]] },
  // A long diagonal slab with a stepped edge, unlike the rounder originals.
  { name:'Slab', points:[[-.95,-.09],[-.51,-.64],[.37,-.86],[.82,-.43],[.91,.07],[.37,.16],[.04,.79],[-.62,.68]], craters:[[-.28,.13,.23],[.36,-.34,.14]] },
  // A hooked broken fragment: an open bite, asymmetric tip and heavy base.
  { name:'Hook', points:[[-.83,-.49],[-.21,-.97],[.64,-.61],[.91,-.1],[.38,-.27],[.05,.02],[.65,.48],[.13,.94],[-.56,.7],[-.94,.03]], craters:[[-.44,-.2,.18],[-.27,.43,.22],[.25,.6,.09]] },
].map(shape => Object.freeze(shape)));

export function meteorPositionAt(meteor, time) {
  const age = time - meteor.spawnAt;
  return { x: meteor.startX - meteor.speed * age, y: meteor.y, angle: meteor.angle + meteor.spin * age };
}

export function projectedThreat(meteor) {
  const radius = meteor.diameter / 2 + meteorRules.strokeWidth / 2;
  const halfWidth = ship.width / 2 + meteorRules.safety;
  const halfHeight = ship.height / 2 + meteorRules.safety;
  const crossingAt = meteor.spawnAt + (meteor.startX - meteorRules.shipX) / meteor.speed;
  const halfTime = (halfWidth + radius) / meteor.speed;
  return {
    id: meteor.id, crossingAt, projectedY: meteor.y,
    startAt: crossingAt - halfTime, endAt: crossingAt + halfTime,
    top: meteor.y - radius - halfHeight, bottom: meteor.y + radius + halfHeight,
    radius, meteor,
  };
}

function freeRanges(threats) {
  const bounds = shipSafeVerticalRange;
  const blocked = threats.map(t => [Math.max(bounds.top,t.top), Math.min(bounds.bottom,t.bottom)])
    .filter(([a,b]) => b > a).sort((a,b) => a[0]-b[0]);
  const ranges = []; let low = bounds.top;
  for (const [a,b] of blocked) { if (a > low) ranges.push([low,a]); low = Math.max(low,b); }
  if (low < bounds.bottom) ranges.push([low,bounds.bottom]);
  return ranges;
}

// On every ship move Y is monotone (quintic easing); meteor Y is constant.
// Restricted to the exact horizontal-overlap time interval, endpoint extrema
// therefore prove separation for the whole interval, including between frames.
export function certifyMeteorSafety(meteors, timeline, startAt = meteorRules.startAt, endAt = Infinity) {
  let minimumClearance = Infinity;
  const collisions = [];
  for (const meteor of meteors) {
    const threat = projectedThreat(meteor);
    const lo = Math.max(startAt,threat.startAt), hi = Math.min(endAt,threat.endAt);
    if (hi <= lo) continue;
    const knots = [...new Set([lo,hi,...timeline.moves.flatMap(m => [m.startAt,m.endAt]).filter(t => t>lo && t<hi)])].sort((a,b)=>a-b);
    for (let i=1;i<knots.length;i++) {
      const a=shipPoseAt(knots[i-1],timeline).y,b=shipPoseAt(knots[i],timeline).y;
      const min=Math.min(a,b),max=Math.max(a,b);
      const distance = meteor.y < min ? min-meteor.y : meteor.y > max ? meteor.y-max : 0;
      const clearance = distance - ship.height/2 - threat.radius;
      minimumClearance = Math.min(minimumClearance,clearance);
      if (clearance < meteorRules.safety-1e-6) collisions.push({id:meteor.id,startAt:knots[i-1],endAt:knots[i],clearance});
    }
  }
  return {safe:!collisions.length,collisions,minimumClearance:round(minimumClearance)};
}

export function planMeteorDodges(meteors, { startAt=meteorRules.startAt, endAt=Infinity, initialY=ship.finalY } = {}) {
  const timeline = { flight:{finalX:meteorRules.shipX,finalY:initialY}, moves:[], decisions:[] };
  const threats=meteors.map(projectedThreat).filter(t=>t.endAt>=startAt && t.startAt<endAt).sort((a,b)=>a.startAt-b.startAt);
  const groups=[];
  for (const t of threats) {
    const last=groups.at(-1);
    if(last && t.startAt-last.endAt<meteorRules.groupGap){last.threats.push(t);last.endAt=Math.max(last.endAt,t.endAt);}
    else groups.push({startAt:t.startAt,endAt:t.endAt,threats:[t]});
  }
  let y=initialY,availableAt=startAt;
  for(const group of groups) {
    const dangerous=group.threats.filter(t=>y>=t.top && y<=t.bottom);
    const common={at:group.startAt,until:group.endAt,fromY:y,considered:group.threats.map(t=>t.id),threats:dangerous.map(t=>t.id),projections:group.threats.map(({meteor,...t})=>t)};
    if(!dangerous.length){timeline.decisions.push({...common,direction:'IGNORE',toY:y});availableAt=Math.max(availableAt,group.endAt);continue;}
    const candidates=freeRanges(group.threats).filter(([a,b])=>b-a>2)
      .map(([a,b])=>({y:(a+b)/2,clearance:(b-a)/2,range:[a,b]}))
      .sort((a,b)=>b.clearance-a.clearance || Math.abs(a.y-y)-Math.abs(b.y-y));
    let choice;
    for(const candidate of candidates) {
      const duration=Math.max(.55,Math.abs(candidate.y-y)*1.875/meteorRules.maxShipSpeed);
      const end=group.startAt-meteorRules.reactionGuard,start=end-duration;
      if(start<availableAt-1e-7)continue;
      const move={startAt:start,endAt:end,fromY:y,toY:candidate.y};
      const trial={...timeline,moves:[...timeline.moves,move]};
      if(!certifyMeteorSafety(meteors,trial,startAt,group.endAt).safe)continue;
      choice={move,candidate};break;
    }
    if(!choice)return {safe:false,reason:'No certified escape',group,timeline};
    timeline.moves.push(choice.move);
    timeline.decisions.push({...common,direction:choice.candidate.y<y?'UP':'DOWN',toY:choice.candidate.y,move:choice.move,freeRanges:freeRanges(group.threats),clearance:choice.candidate.clearance});
    y=choice.candidate.y;availableAt=group.endAt;
  }
  const certificate=certifyMeteorSafety(meteors,timeline,startAt,endAt);
  return {safe:certificate.safe,timeline,certificate};
}

export function meteorOccurrences(field, until=field.timeline.flight.repeatAt+field.timeline.flight.period) {
  const occurrences=[];
  for(let cycle=0;cycle<=Math.ceil((until-meteorRules.startAt)/field.period);cycle++) {
    for(const meteor of field.meteors)occurrences.push({...meteor,id:`${meteor.id}-${cycle}`,spawnAt:meteor.spawnAt+cycle*field.period});
  }
  return occurrences;
}

function compile(meteors,period) {
  const occurrences=[];
  for(let cycle=0;cycle<5;cycle++)for(const m of meteors)occurrences.push({...m,id:`${m.id}-${cycle}`,spawnAt:m.spawnAt+cycle*period});
  const end=meteorRules.startAt+4*period;
  const planned=planMeteorDodges(occurrences,{endAt:end});
  if(!planned.safe)return null;
  const lag=Math.max(...shipTrailLags);
  const earliest=meteorRules.startAt+period;
  // Place the ship's technical seam in a natural hold, while meteor traffic
  // continues. No forbidden spawn band or empty wave is manufactured here.
  const seams=[earliest,...planned.timeline.moves.filter(m=>m.endAt>=earliest && m.endAt<earliest+period).map(m=>m.endAt+lag+.05)];
  for(const a of seams) {
    const b=a+period;
    if(b>end)continue;
    if(planned.timeline.moves.some(m=>(m.startAt<a+.05 && m.endAt>a-lag)||(m.startAt<b+.05 && m.endAt>b-lag)))continue;
    if(Math.abs(shipPoseAt(a,planned.timeline).y-shipPoseAt(b,planned.timeline).y)>1e-8)continue;
    const timeline={...planned.timeline,moves:planned.timeline.moves.filter(m=>m.endAt<=b),decisions:planned.timeline.decisions.filter(d=>d.at<b)};
    timeline.flight={...timeline.flight,repeatAt:a,period};
    const certificate=certifyMeteorSafety(occurrences,timeline,meteorRules.startAt,b);
    if(certificate.safe)return {timeline,certificate};
  }
  return null;
}

function visibleMeteorCount(meteors,period) {
  // Circular interval sweep. Visible when any part of the circumscribed shape
  // reaches the viewBox; no frame sampling can miss a population peak.
  const events=[];
  for(const m of meteors){
    const r=m.diameter/2+meteorRules.strokeWidth/2;
    const a=((m.spawnAt-meteorRules.startAt+(m.startX-canvas.right-r)/m.speed)%period+period)%period;
    const duration=(canvas.width+2*r)/m.speed;
    for(const shift of[-period,0,period]){const lo=Math.max(0,a+shift),hi=Math.min(period,a+shift+duration);if(hi>lo)events.push([lo,1],[hi,-1]);}
  }
  events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let current=0,max=0;
  for(const[,delta]of events){current+=delta;max=Math.max(max,current);}
  return max;
}

export function createMeteorField({seed=randomBytes(16).toString('hex')}={}) {
  const random=seeded(`meteor:${seed}`),meteors=[];
  const period=meteorRules.period;
  let rejected=0;
  for(let i=0;i<meteorRules.count;i++) {
    let accepted=false;
    for(let attempt=0;attempt<160;attempt++) {
      const mix=random(),kind=mix<.4?0:mix<.85?1:2;
      const diameter=round([12,18,24][kind]+random()*[5,5,6][kind]);
      const speed=round([58,68,80][kind]+random()*[7,8,8][kind]);
      const radius=diameter/2+meteorRules.strokeWidth/2;
      const meteor={id:`meteor-${i}`,kind:['small','medium','large'][kind],shape:Math.floor(random()*(kind ? meteorShapes.length : 6)),diameter,speed,
        y:round(canvas.top+radius+3+random()*(canvas.height-2*radius-6)),
        spawnAt:round(Math.max(meteorRules.startAt+.1,meteorRules.startAt+i*period/meteorRules.count+.2+random()*1.4+(attempt ? (random()-.5)*4 : 0))),
        startX:round(canvas.right+radius+1),endX:round(canvas.left-radius-1),
        angle:round(random()*360),spin:round((random()<.5?-1:1)*(8+random()*10))};
      meteor.travelDuration=(meteor.startX-meteor.endX)/speed;
      // Proposal geometry is independent of the ship. The separate planner
      // certifies the full field; harmless crossings are retained as well.
      if(visibleMeteorCount([...meteors,meteor],period)>meteorRules.maxVisible || visibleMeteorCount([...meteors,meteor].filter(m=>m.kind==='large'),period)>meteorRules.maxLargeVisible){rejected++;continue;}
      const compiled=compile([...meteors,meteor],period);
      if(!compiled){rejected++;continue;}
      meteors.push(meteor);accepted=true;break;
    }
    if(!accepted)throw new Error(`Unable to certify meteor spawn ${i}; no unsafe SVG emitted.`);
  }
  const compiled=compile(meteors,period);
  if(!compiled)throw new Error('Meteor loop certification failed.');
  return {sceneMode:'METEOR_DODGE',algorithm:'projected-envelope-dodge-v2',perpetual:true,seed,period,meteors,
    timeline:compiled.timeline,certificate:compiled.certificate,rejectedSpawns:rejected,
    maxVisible:visibleMeteorCount(meteors,period),initialActiveCells:0,displayedInvaders:0};
}

export function meteorShapeMarkup(index,theme='dark') {
  const shape=meteorShapes[index];
  const fill=theme==='dark'?'#53616e':'#c2cbd0',stroke=theme==='dark'?'#b7c4cb':'#526571';
  const d=shape.points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join('')+'Z';
  const craters=shape.craters.map(([x,y,r])=>`<path d="M${round(x-r)} ${y}l${round(r*.55)} ${round(-r*.8)} ${round(r*1.05)} ${round(-r*.12)} ${round(r*.48)} ${round(r*.9)} ${round(-r*.7)} ${round(r*.75)} ${round(-r)} ${round(-r*.1)}Z" fill="none" stroke="${stroke}" stroke-width=".045" opacity=".6"/>`).join('');
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width=".055" stroke-linejoin="round"/>${craters}<path d="M-.6-.22l.17-.19" fill="none" stroke="${index%3===0?'accent':stroke}" stroke-width=".055" opacity=".7"/>`;
}

export function meteorStyles(field) {
  return field.meteors.map(m=>{
    const percent=m.travelDuration/field.period*100;
    return `@keyframes travel-${m.id}{0%{transform:translate(${m.startX}px,${m.y}px);opacity:1}${round(percent)}%{transform:translate(${m.endX}px,${m.y}px);opacity:1}${round(percent+.001)}%,100%{transform:translate(${m.endX}px,${m.y}px);opacity:0}}
@keyframes spin-${m.id}{from{transform:rotate(${m.angle}deg)}to{transform:rotate(${round(m.angle+m.spin*field.period)}deg)}}`;
  }).join('\n');
}

export function meteorMarkup(field,theme='dark',timeOffset=0) {
  const delay=m=>timeOffset?round(m.spawnAt-timeOffset):m.spawnAt;
  const moving=field.meteors.map(m=>`<g class="meteor" data-meteor="${m.id}" style="opacity:0;animation:travel-${m.id} ${field.period}s linear ${delay(m)}s infinite"><g class="meteor-spin" style="animation:spin-${m.id} ${field.period}s linear ${delay(m)}s infinite"><g transform="scale(${m.diameter/2})">${meteorShapeMarkup(m.shape,theme)}</g></g></g>`).join('');
  const staticMeteors=[0,1,2].map((i)=>{const m=field.meteors[i],x=canvas.left+canvas.width*[.2,.68,.87][i],y=canvas.top+canvas.height*[.25,.76,.2][i];return `<g transform="translate(${x} ${y}) rotate(${m.angle}) scale(${m.diameter/2})">${meteorShapeMarkup(m.shape,theme)}</g>`}).join('');
  return `<g class="meteor-field" clip-path="url(#field)">${moving}</g><g class="meteor-static" clip-path="url(#field)">${staticMeteors}</g>`;
}
