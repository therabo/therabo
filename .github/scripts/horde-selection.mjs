import { randomFor } from './random.mjs';
import { region, motionEnvelopes, motionCaps } from './motion-geometry.mjs';

// See ADR-0001. These are distances/readability budgets, never a count threshold.
export const readable = Object.freeze({ spriteSize: 12, minimumSeparation: 23.6, meanHorizontal: 12, smallHorizontal: 3, maximumSmallFraction: .1, minimumVertical: .3, verticalBudget: 1.5, guard: .6, separation: 1.1 });
const round = n => Number(n.toFixed(6));
const distance = (a, b) => Math.hypot(a.x-b.x,a.y-b.y);
export function components(cells) {
  const unseen=new Set(cells.map((_,i)=>i)),groups=[];
  while(unseen.size){const stack=[unseen.values().next().value],group=[];unseen.delete(stack[0]);while(stack.length){const i=stack.pop();group.push(i);for(const j of [...unseen])if(distance(cells[i],cells[j])<=36){unseen.delete(j);stack.push(j);}}groups.push(group);}
  return groups;
}
const affine=c=>({x:196+.68*(c.x-2),y:-10+1.22*(c.y-2)});
const stratum=c=>`${Math.floor(c.week/4)}:${Math.floor(c.row/3)}`;
export function sourceTopology(cells) {
  const points=cells.map(affine),groups=components(cells),nearest=points.map((p,i)=>Math.min(Infinity,...points.filter((_,j)=>i!==j).map(q=>distance(p,q))));
  const isolated=nearest.flatMap((d,i)=>d>=65?[i]:[]),xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),gaps=xs.slice(1).flatMap((x,i)=>x-xs[i]>=40?[{left:xs[i],right:x}]:[]);
  return {groups,isolated,nearest,gaps,points};
}
// The area estimate seeds the search; it is NOT a hard n>k rule or an impossibility proof.
export function estimateCapacity(cells) {
  const {spriteSize:s,minimumSeparation:d,meanHorizontal:x,verticalBudget:y,separation:gap,guard}=readable;
  const width=region.right-region.left-s-2*guard,height=region.bottom-region.top-s-2*guard,area=width*height;
  const areaPerInvader=Math.max(d*d,(s+2*x+gap)*(s+2*y+gap));
  const globalEstimate=Math.floor(area/areaPerInvader),topology=sourceTopology(cells);
  const territories=topology.groups.map(ids=>({ids,center:ids.reduce((v,i)=>v+topology.points[i].x,0)/ids.length})).sort((a,b)=>a.center-b.center);
  let localEstimate=0;
  const local=territories.map((g,i)=>{const left=i?(territories[i-1].center+g.center)/2:region.left,right=i+1<territories.length?(g.center+territories[i+1].center)/2:region.right;const capacity=Math.max(1,Math.floor(globalEstimate*Math.max(0,right-left)/(region.right-region.left)));localEstimate+=Math.min(g.ids.length,capacity);return{active:g.ids.length,capacity,territory:[round(left),round(right)]};});
  // Non-overlapping disks around centres fit within the rectangle expanded by d/2.
  const diskAreaUpperBound=Math.floor(((region.right-region.left-s+d)*(region.bottom-region.top-s+d))/(Math.PI*(d/2)**2));
  return {maxReadableInvaders:Math.min(cells.length,globalEstimate,localEstimate),globalEstimate,diskAreaUpperBound,area:round(area),areaPerInvader:round(areaPerInvader),spriteSize:s,minimumSeparation:d,meanHorizontalBudget:x,verticalBudget:y,local,estimateOnly:true};
}
function quotas(groups,total,random) {
  const count=groups.reduce((s,g)=>s+g.length,0),q=groups.map(g=>Math.floor(total*g.length/Math.max(1,count))),fractions=groups.map((g,i)=>({i,key:total*g.length/Math.max(1,count)-q[i]+random()*1e-6})).sort((a,b)=>b.key-a.key);
  for(let remaining=total-q.reduce((s,n)=>s+n,0),i=0;remaining>0;i++,remaining--)q[fractions[i%fractions.length].i]++;
  return q;
}
export function selectRepresentative(cells,requested,seed) {
  const count=Math.min(cells.length,Math.max(0,Math.floor(requested))),random=randomFor(seed),topology=sourceTopology(cells),mandatory=new Set(topology.isolated);
  for(const ids of topology.groups){mandatory.add(ids[Math.floor(random()*ids.length)]);if(ids.length>=12){mandatory.add(ids.reduce((a,b)=>cells[a].x<=cells[b].x?a:b));mandatory.add(ids.reduce((a,b)=>cells[a].x>=cells[b].x?a:b));}}
  if(cells.length){for(const axis of ['x','y']){mandatory.add(cells.reduce((a,c,i)=>c[axis]<cells[a][axis]?i:a,0));mandatory.add(cells.reduce((a,c,i)=>c[axis]>cells[a][axis]?i:a,0));}}
  // Every present intensity keeps a representative, including a rare level-1 day.
  for(const level of [1,2,3,4]){const ids=cells.flatMap((c,i)=>c.level===level?[i]:[]);if(ids.length&&![...mandatory].some(i=>cells[i].level===level))mandatory.add(ids[Math.floor(random()*ids.length)]);}
  if(count<mandatory.size)throw new Error(`Structural representatives need ${mandatory.size} sprites; requested ${count}`);
  const selected=new Set(mandatory),remainingGroups=topology.groups.map(ids=>ids.filter(i=>!selected.has(i))),groupQuotas=quotas(remainingGroups,count-selected.size,random);
  remainingGroups.forEach((ids,gi)=>{const bins=new Map();for(const i of ids){const key=stratum(cells[i]);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);}const arrays=[...bins.values()],qs=quotas(arrays,groupQuotas[gi],random);arrays.forEach((bin,k)=>{const priorities=bin.map(i=>({i,key:-Math.log(Math.max(Number.MIN_VALUE,random()))/(1+.08*(cells[i].level-1))})).sort((a,b)=>a.key-b.key);for(const {i}of priorities.slice(0,qs[k]))selected.add(i);});});
  const retained=cells.filter((_,i)=>selected.has(i));
  if(retained.length!==count)throw new Error('Invalid proportional sampling count');
  return {cells:retained,selectedDates:retained.map(c=>c.date),mandatoryDates:[...mandatory].map(i=>cells[i].date).sort(),metrics:samplingMetrics(cells,retained,topology)};
}
function pearson(a,b){if(a.length<2)return null;const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;let cov=0,va=0,vb=0;for(let i=0;i<a.length;i++){cov+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2;}return va*vb?round(cov/Math.sqrt(va*vb)):null;}
export function samplingMetrics(full,selected,topology=sourceTopology(full)) {
  const dates=new Set(selected.map(c=>c.date)),bins=new Map();for(const c of full){const key=stratum(c);if(!bins.has(key))bins.set(key,{source:0,selected:0});bins.get(key).source++;if(dates.has(c.date))bins.get(key).selected++;}
  const counts=[...bins.values()],a=counts.map(b=>b.source),b=counts.map(b=>b.selected);let ranked=0,concordant=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]!==a[j]){ranked++;if((a[i]-a[j])*(b[i]-b[j])>0)concordant++;else if(b[i]===b[j])concordant+=.5;}
  const groupsRetained=topology.groups.filter(ids=>ids.some(i=>dates.has(full[i].date))).length,outliersRetained=topology.isolated.filter(i=>dates.has(full[i].date)).length;
  const preservedGaps=topology.gaps.filter(g=>selected.some(c=>affine(c).x<=g.left)&&selected.some(c=>affine(c).x>=g.right)).length;
  const extent=(points,axis)=>points.length?Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis])):0,points=selected.map(affine),fullNN=[],sampleNN=[];
  for(const c of selected){const i=full.findIndex(p=>p.date===c.date);fullNN.push(Number.isFinite(topology.nearest[i])?topology.nearest[i]:0);sampleNN.push(selected.length>1?Math.min(...selected.filter(p=>p!==c).map(p=>distance(affine(c),affine(p)))):0);}
  const clusterCounts=topology.groups.map(ids=>({source:ids.length,selected:ids.filter(i=>dates.has(full[i].date)).length}));
  return {totalActiveDays:full.length,displayedInvaders:selected.length,samplingRatio:full.length?round(selected.length/full.length):1,clusters:topology.groups.length,clustersRetained:groupsRetained,clusterRetention:topology.groups.length?groupsRetained/topology.groups.length:1,structuralOutliers:topology.isolated.length,outliersRetained,outlierRetention:topology.isolated.length?outliersRetained/topology.isolated.length:1,majorSeparations:topology.gaps.length,majorSeparationsPreserved:preservedGaps,densityCorrelation:pearson(a,b),localDensityRanking:ranked?round(concordant/ranked):null,spatialCoverage:{x:extent(topology.points,'x')?round(extent(points,'x')/extent(topology.points,'x')):1,y:extent(topology.points,'y')?round(extent(points,'y')/extent(topology.points,'y')):1,strata:counts.length?round(counts.filter(b=>b.selected).length/counts.length):1},nearestNeighbourStructureCorrelation:pearson(fullNN,sampleNN),clusterMassTotalVariation:full.length&&selected.length?round(clusterCounts.reduce((v,g)=>v+Math.abs(g.source/full.length-g.selected/selected.length),0)/2):0,levelCounts:[1,2,3,4].map(level=>({level,source:full.filter(c=>c.level===level).length,selected:selected.filter(c=>c.level===level).length})),clusterCounts,strata:counts};
}
export function measureReadability(anchors,caps=motionCaps(anchors,1)) {
  try{const e=motionEnvelopes(anchors,1,caps),horizontal=e.map(p=>Math.max(p.availableLeft,p.availableRight)),mean=horizontal.length?horizontal.reduce((s,x)=>s+x,0)/horizontal.length:27,small=horizontal.filter(x=>x<readable.smallHorizontal).length;
  return {valid:mean>=readable.meanHorizontal&&small<=anchors.length*readable.maximumSmallFraction&&e.every(p=>Math.min(p.availableUp,p.availableDown)>=readable.minimumVertical),meanHorizontal:round(mean),smallHorizontal:small,smallFraction:anchors.length?round(small/anchors.length):0,minimumVertical:e.length?Math.min(...e.map(p=>Math.min(p.availableUp,p.availableDown))):5};}catch(error){return{valid:false,reason:error.message};}
}

// Full sets keep priority. Representative hordes also reserve organic negative
// space: the approved 144-sprite scene occupies about 15.6% with sprite bodies.
// 12 remains a motion preference, with a 10% tolerance, not a universal cutoff.
const visualQuality = Object.freeze({ motionTarget: readable.meanHorizontal, motionTolerance: .9, maximumBodyCoverage: .16 });
export function representativeCountBudget() {
  return Math.floor((region.right-region.left)*(region.bottom-region.top)*visualQuality.maximumBodyCoverage/(readable.spriteSize**2));
}
export function qualityGuard(anchors,caps=motionCaps(anchors,1),{representative=false}={}) {
  const motion=measureReadability(anchors,caps),minimumHorizontal=visualQuality.motionTarget*visualQuality.motionTolerance;
  const bodyCoverage=anchors.length*readable.spriteSize**2/((region.right-region.left)*(region.bottom-region.top));
  const errors=[];
  if(motion.meanHorizontal===undefined||motion.meanHorizontal<minimumHorizontal)errors.push('insufficient-mean-motion');
  if(motion.smallFraction>readable.maximumSmallFraction||motion.minimumVertical<readable.minimumVertical)errors.push('insufficient-local-motion');
  if(representative&&bodyCoverage>visualQuality.maximumBodyCoverage)errors.push('excessive-body-coverage');
  return{valid:!errors.length,errors,motion,minimumHorizontal,bodyCoverage,maximumBodyCoverage:representative?visualQuality.maximumBodyCoverage:null};
}

export function validateSampling(metrics) {
  const errors=[];
  if(metrics.levelCounts.some(g=>g.source>0&&g.selected===0))errors.push('intensity-level-loss');
  if(metrics.clustersRetained!==metrics.clusters)errors.push('cluster-loss');
  if(metrics.outliersRetained!==metrics.structuralOutliers)errors.push('outlier-loss');
  if(metrics.majorSeparationsPreserved!==metrics.majorSeparations)errors.push('separation-loss');
  if(metrics.spatialCoverage.x<.999999||metrics.spatialCoverage.y<.999999)errors.push('extent-loss');
  if(metrics.displayedInvaders>=24){
    if(metrics.densityCorrelation!==null&&metrics.densityCorrelation<.8)errors.push('density-distortion');
    if(metrics.localDensityRanking!==null&&metrics.localDensityRanking<.75)errors.push('density-ranking');
    if(metrics.clusterMassTotalVariation>.15)errors.push('cluster-mass-distortion');
  }
  return {valid:!errors.length,errors};
}
