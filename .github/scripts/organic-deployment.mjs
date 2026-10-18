import { randomFor } from './random.mjs';
import { randomBytes, createHash } from 'node:crypto';

// Generation-time randomness only. SVGs contain the resulting coordinates, never JS.
// Full sprite + motion-envelope limits, not anchor centres or top-left maxima.
// Full-Length targets use the approved 15% reserve and 22-unit right margin.
// Geometry stays independent of full-set search and readable subset selection.
import { region, horizontalGuard, motionCaps, motionEnvelopes, intervalOverlap, invaderGeometry } from './motion-geometry.mjs';
import { components, readable, estimateCapacity, selectRepresentative, measureReadability, validateSampling, samplingMetrics, qualityGuard, representativeCountBudget } from './horde-selection.mjs';
import { coherentDeployment, transportPaths, firstPathConflict } from './deployment-routes.mjs';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const round = n => Number(n.toFixed(6));


function ranks(values) {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v), result = [];
  for (let i = 0; i < order.length;) {
    let j = i + 1;
    while (j < order.length && Math.abs(order[j].v - order[i].v) < 1e-8) j++;
    for (let k = i; k < j; k++) result[order[k].i] = (i + j - 1) / 2;
    i = j;
  }
  return result;
}

function correlation(a, b) {
  if (a.length < 2) return 1;
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return va * vb ? cov / Math.sqrt(va * vb) : 1;
}

function neighbours(points, k) {
  return points.map((p, i) => points.map((q, j) => ({ j, d: distance(p, q) }))
    .filter(q => q.j !== i).sort((a, b) => a.d - b.d || a.j - b.j).slice(0, k));
}

function coefficientOfVariation(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return mean ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) / mean : 0;
}

// Stretch the existing organic layout, including its random offsets and gaps.
// One positive affine map preserves horizontal order and relative distances;
// sprite size and vertical coordinates are never scaled. Adaptive envelopes
// continue to derive their available room from the unchanged scene bounds.
function spreadHorizontalAnchors(anchors, scale = 1) {
  if (anchors.length < 2) return anchors;
  const left = Math.min(...anchors.map(p => p.x)), right = Math.max(...anchors.map(p => p.x));
  const start = region.left + horizontalGuard * scale, end = region.right - (12 + horizontalGuard) * scale;
  if (right - left < 1e-6 || right - left >= end - start) return anchors;
  const factor = (end - start) / (right - left);
  return anchors.map(p => ({ ...p, x: round(start + (p.x - left) * factor) }));
}

function densityMetrics(cells, anchors) {
  // Measure proximity after the allowed affine compression, before random offsets.
  const source = cells.map(c => ({ x: .68 * (c.x - 2), y: 1.22 * (c.y - 2) }));
  const a = [], b = [];
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    a.push(distance(source[i], source[j])); b.push(distance(anchors[i], anchors[j]));
  }
  const k = Math.max(0, Math.min(4, cells.length - 1)), na = neighbours(source, k), nb = neighbours(anchors, k);
  const retention = k ? na.reduce((n, v, i) => n + v.filter(q => nb[i].some(r => r.j === q.j)).length / k, 0) / cells.length : 1;
  const sourceNN = na.map(q => q[0]?.d || 0), finalNN = nb.map(q => q[0]?.d || 0);
  const isolated = sourceNN.map((d, i) => ({ d, i })).filter(q => q.d >= 65);
  const xs = [...new Set(source.map(p => p.x))].sort((a, b) => a - b);
  const gaps = xs.slice(1).map((x, i) => ({ left: xs[i], right: x })).filter(g => g.right - g.left >= 40);
  const preservedGaps = gaps.filter(g => {
    const left = Math.max(...anchors.filter((_, i) => source[i].x <= g.left).map(p => p.x));
    const right = Math.min(...anchors.filter((_, i) => source[i].x >= g.right).map(p => p.x));
    return right - left >= Math.min(20, (g.right - g.left) * .3);
  });
  return {
    proximityCorrelation: round(correlation(ranks(a), ranks(b))), neighbourRetention: round(retention),
    sourceNearestCV: round(coefficientOfVariation(sourceNN)), feasibleNearestCV: round(coefficientOfVariation(sourceNN.map(d => Math.max(23.6, d)))), finalNearestCV: round(coefficientOfVariation(finalNN)),
    isolatedSource: isolated.length, isolatedPreserved: isolated.filter(q => finalNN[q.i] >= 42).length,
    sourceGaps: gaps.length, preservedGaps: preservedGaps.length,
    minDistance: round(b.length ? Math.min(...b) : 0), maxDistance: round(b.length ? Math.max(...b) : 0),
  };
}


function placeAnchors(cells, random, scale) {
  const size = 12 * scale, minimum = 23.6 * scale;
  const targets = cells.map(c => ({ date: c.date, x: 196 + .68 * (c.x - 2), y: -10 + 1.22 * (c.y - 2) }));
  // Related days share a small cluster rotation/translation, then receive local jitter.
  for (const ids of components(cells)) {
    const cx = ids.reduce((s, i) => s + targets[i].x, 0) / ids.length, cy = ids.reduce((s, i) => s + targets[i].y, 0) / ids.length;
    const dx = (random() - .5) * 12, dy = (random() - .5) * 10, angle = (random() - .5) * .14;
    for (const i of ids) {
      const p = targets[i], x = p.x - cx, y = p.y - cy;
      p.x = cx + x * Math.cos(angle) - y * Math.sin(angle) + dx + (random() - .5) * 9 * scale;
      p.y = cy + x * Math.sin(angle) + y * Math.cos(angle) + dy + (random() - .5) * 14 * scale;
    }
  }
  const points = targets.map(p => ({ ...p }));
  const bound = p => {
    p.x = clamp(p.x, region.left + horizontalGuard * scale, region.right - size - horizontalGuard * scale);
    p.y = clamp(p.y, region.top + invaderGeometry.verticalAnchorInset * scale, region.bottom - size - invaderGeometry.verticalAnchorInset * scale);
  };
  // A weak tether preserves density; repulsion resolves local crowding, not coverage.
  for (let pass = 0; pass < 450; pass++) {
    if (pass < 300) for (let i = 0; i < points.length; i++) {
      points[i].x += (targets[i].x - points[i].x) * .012;
      points[i].y += (targets[i].y - points[i].y) * .012;
    }
    let worst = 0;
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j];
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= minimum) continue;
      if (d < 1e-6) { const angle = random() * Math.PI * 2; dx = Math.cos(angle); dy = Math.sin(angle); d = 1; }
      const force = (minimum - d) * .51; worst = Math.max(worst, minimum - d);
      a.x -= dx / d * force; a.y -= dy / d * force; b.x += dx / d * force; b.y += dy / d * force;
    }
    points.forEach(bound);
    if (pass >= 300 && worst < .0001) break;
  }
  return spreadHorizontalAnchors(points.map(p => ({ date: p.date, x: round(p.x), y: round(p.y) })), scale);
}

function intersects(a, b, margin = 0) {
  return a.x < b.x + b.size + margin && b.x < a.x + a.size + margin && a.y < b.y + b.size + margin && b.y < a.y + a.size + margin;
}
const smooth = p => p * p * p * (p * (p * 6 - 15) + 10);

// Exact continuous AABB test between two linear CSS knots, including changing scale.

function deploymentPaths(cells, anchors, scale, random) {
  const steps = 64, n = cells.length;
  const params = cells.map(() => ({ delay: random() * .12, duration: 4.02 + random() * .2, arcX: (random() - .5) * 6, arcY: (random() - .5) * 9 }));
  const frames = [];
  let previous, desiredPrevious;
  for (let frame = 0; frame <= steps; frame++) {
    const time = frame / steps * region.deployDuration;
    const desired = cells.map((c, i) => {
      const a = anchors[i], q = params[i], p = smooth(clamp((time - q.delay) / q.duration, 0, 1));
      return { x: c.x + (a.x - c.x) * p + Math.sin(Math.PI * p) * q.arcX, y: c.y + (a.y - c.y) * p + Math.sin(Math.PI * p) * q.arcY, size: 12 * (1 + (scale - 1) * p) };
    });
    let points = desired.map((p, i) => ({ ...p, x: p.x + (previous ? (previous[i].x - desiredPrevious[i].x) * .75 : 0), y: p.y + (previous ? (previous[i].y - desiredPrevious[i].y) * .75 : 0) }));
    if (frame === steps) points = desired.map(p => ({ ...p }));
    for (let iter = 0; iter < 30 && frame !== 0 && frame !== steps; iter++) {
      let hits = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = points[i], b = points[j];
        if (!intersects(a, b, 1.6)) continue;
        const dx = b.x + b.size / 2 - a.x - a.size / 2, dy = b.y + b.size / 2 - a.y - a.size / 2;
        const ox = (a.size + b.size) / 2 + 1.6 - Math.abs(dx), oy = (a.size + b.size) / 2 + 1.6 - Math.abs(dy);
        if (ox < oy) { const push = (ox + .002) / 2 * (Math.sign(dx) || 1); a.x -= push; b.x += push; }
        else { const push = (oy + .002) / 2 * (Math.sign(dy) || 1); a.y -= push; b.y += push; }
        hits++;
      }
      if (!hits) break;
    }
    frames.push(points); previous = points; desiredPrevious = desired;
  }
  return cells.map((c, i) => ({ date: c.date, frames: frames.map((f, k) => ({ percent: round(k / steps * 100), tx: round(f[i].x - c.x * f[i].size / 12), ty: round(f[i].y - c.y * f[i].size / 12), scale: round(f[i].size / 12) })) }));
}

export function validatePaths(cells, deployment) {
  const { paths, anchors, scale } = deployment, errors = [];
  if (!paths || paths.length !== cells.length || paths.some((p, i) => p.date !== cells[i].date || p.frames.length !== 65)) return ['paths'];
  const frames = Array.from({ length: 65 }, (_, k) => paths.map((path, i) => {
    const f = path.frames[k], c = cells[i];
    return { x: c.x * f.scale + f.tx, y: c.y * f.scale + f.ty, size: 12 * f.scale };
  }));
  for (let i = 0; i < cells.length; i++) {
    if (distance(frames[0][i], cells[i]) > .0001 || Math.abs(frames[0][i].size - 12) > .0001 || distance(frames[64][i], anchors[i]) > .001 || Math.abs(frames[64][i].size - 12 * scale) > .001) errors.push('path-endpoints');
  }
  for (let f = 0; f < frames.length; f++) for (let i = 0; i < cells.length; i++) {
    const a = frames[f][i];
    if (![a.x, a.y, a.size].every(Number.isFinite) || a.size <= 0 || a.x < -16 || a.x + a.size > 864 || a.y < -32 || a.y + a.size > 160) errors.push('path-bounds');
    if (f && distance(a, frames[f - 1][i]) > 12) errors.push('path-jump');
    if (f) for (let j = i + 1; j < cells.length; j++) if (intervalOverlap(frames[f - 1][i], a, frames[f - 1][j], frames[f][j], .15)) errors.push('path-collision');
  }
  return [...new Set(errors)];
}

export function validateDeployment(cells, deployment) {
  const errors = [], { anchors, scale } = deployment, size = 12 * scale;
  if (!Number.isFinite(scale) || scale !== 1 || anchors.length !== cells.length || anchors.some((a, i) => a.date !== cells[i]?.date || !Number.isFinite(a.x) || !Number.isFinite(a.y))) return { valid: false, errors: ['identity-or-geometry'] };
  for (const a of anchors) if (a.x < region.left || a.x + size > region.right || a.y < region.top || a.y + size > region.bottom) errors.push('bounds');
  const metrics = densityMetrics(cells, anchors);
  if (cells.length > 1 && metrics.minDistance < readable.minimumSeparation - .001) errors.push('minimum-separation');
  if (cells.length >= 12) {
    if (metrics.proximityCorrelation < .88) errors.push('proximity');
    if (metrics.neighbourRetention < .48) errors.push('neighbours');
    if (metrics.feasibleNearestCV > .3 && metrics.finalNearestCV < Math.min(.26, metrics.feasibleNearestCV * .7)) errors.push('uniformity');
    if (metrics.isolatedPreserved < metrics.isolatedSource) errors.push('isolation');
    if (metrics.preservedGaps < metrics.sourceGaps) errors.push('negative-space');
  }
  const caps = motionCaps(anchors, scale);
  try { const directional = motionEnvelopes(anchors, scale, caps); if (directional.some(e => Math.max(e.availableLeft, e.availableRight) < .3 * scale || Math.min(e.availableUp, e.availableDown) < .3 * scale)) errors.push('motion-space'); } catch { errors.push('motion-space'); }
  if (deployment.paths) errors.push(...validatePaths(cells, deployment));
  return { valid: errors.length === 0, errors: [...new Set(errors)], metrics, caps };
}

// Alternative placement uses available height without changing top/bottom bounds.
function expandVerticalAnchors(anchors) {
  if(anchors.length<2)return anchors;
  const low=Math.min(...anchors.map(p=>p.y)),high=Math.max(...anchors.map(p=>p.y));
  const top=region.top+invaderGeometry.verticalAnchorInset,bottom=region.bottom-12-invaderGeometry.verticalAnchorInset;
  if(high-low<1e-6||high-low>=bottom-top)return anchors;
  return anchors.map(p=>({...p,y:round(top+(p.y-low)/(high-low)*(bottom-top))}));
}

function createFullDeployment(allCells, { seed = randomBytes(16).toString('hex'), maxAttempts = 6, onAttempt, representative = false } = {}) {
  const cells=allCells.filter(c=>c.count>0),scale=1,trace=[];
  let safePlacements=0,readablePlacements=0,bestReadability=null,last=['no-attempts'],conflict=null;
  const consider=(candidate,stage)=>{
    const result=validateDeployment(cells,candidate),legible=measureReadability(candidate.anchors,result.caps);
    if(legible.meanHorizontal!==undefined&&(!bestReadability||legible.meanHorizontal>bestReadability.meanHorizontal))bestReadability=legible;
    const quality=qualityGuard(candidate.anchors,result.caps,{representative});
    if(result.valid){safePlacements++;if(quality.valid)readablePlacements++;}
    trace.push({attempt:candidate.attempt,stage,routeMode:candidate.routeMode,errors:[...result.errors,...quality.errors],readability:legible,quality,metrics:result.metrics});
    onAttempt?.({candidate,result:{...result,valid:result.valid&&quality.valid,errors:[...result.errors,...quality.errors]},stage:'placement'});
    return{result,legible,quality};
  };
  const routes=(candidate,result,legible,random)=>{
    const variants=[['approved-curved',()=>deploymentPaths(cells,candidate.anchors,1,random)],['synchronous',()=>transportPaths(cells,candidate.anchors)],['x-first',()=>transportPaths(cells,candidate.anchors,'x-first')],['y-first',()=>transportPaths(cells,candidate.anchors,'y-first')]];
    for(const[mode,build]of variants){
      const routed={...candidate,paths:build(),routeMode:candidate.routeMode+':'+mode},errors=validatePaths(cells,routed);
      trace.push({attempt:candidate.attempt,stage:'route',routeMode:routed.routeMode,errors});
      onAttempt?.({candidate:routed,result:{...result,errors,valid:!errors.length},stage:'paths'});
      if(!errors.length)return{...routed,metrics:result.metrics,caps:result.caps,readability:legible,readabilityPriority:'full-set-then-readable-organic-subset',trace};
      last=errors;if(errors.includes('path-collision'))conflict=firstPathConflict(cells,routed.paths);
    }
    return null;
  };
  for(let attempt=0;attempt<Math.min(6,maxAttempts);attempt++){
    const random=randomFor(seed+':'+attempt),base=placeAnchors(cells,random,scale),anchors=attempt%2?expandVerticalAnchors(base):base;
    let candidate={algorithm:'maximal-fixed-size-v1',seed,attempt:attempt+1,scale,anchors,routeMode:attempt%2?'organic-height-expanded':'organic'};
    let {result,legible,quality}=consider(candidate,'placement');last=[...result.errors,...quality.errors];
    if(result.valid&&quality.valid){const d=routes(candidate,result,legible,random);if(d)return{...d,quality};}
    // Do not spend routing work on grossly overfull unsafe packings.
    if(result.metrics?.minDistance<readable.minimumSeparation-1)continue;
    for(const options of[{matching:'component',reverse:false},{matching:'ordered',reverse:true}]){
      const repaired=coherentDeployment(cells,anchors,options);
      candidate={...candidate,anchors:spreadHorizontalAnchors(repaired.anchors),routeMode:repaired.routeMode+':'+options.matching+(options.reverse?':reverse':'')};
      ({result,legible,quality}=consider(candidate,'repair'));last=[...result.errors,...quality.errors];
      if(result.valid&&quality.valid){const d=routes(candidate,result,legible,random);if(d)return{...d,quality};}
    }
  }
  const error=new Error('No validated organic deployment: '+last.join(', '));
  error.diagnostics={classification:readablePlacements?'ALGORITHMIC_ROUTE':safePlacements?'READABILITY_SEARCH_EXHAUSTED':'PLACEMENT_SEARCH_EXHAUSTED',trace,attempts:Math.min(6,maxAttempts),safePlacements,readablePlacements,bestReadability,firstPathConflict:conflict};throw error;
}


// Approved baseline strategy, kept as a full-set-only compatibility search.
function createBaselineFullDeployment(allCells, { seed = randomBytes(16).toString('hex'), maxAttempts = 32, onAttempt } = {}) {
  const cells=allCells.filter(c=>c.count>0),scale=1,trace=[];
  let last=['no-attempts'],bestReadability=null,readablePlacements=0;
  const consider=(candidate,routeMode)=>{
    const result=validateDeployment(cells,candidate),legible=measureReadability(candidate.anchors,result.caps);
    if(legible.meanHorizontal!==undefined&&(!bestReadability||legible.meanHorizontal>bestReadability.meanHorizontal))bestReadability=legible;
    if(result.valid&&legible.valid)readablePlacements++;
    let errors=[...result.errors];if(!legible.valid)errors.push('readable-motion');
    trace.push({attempt:candidate.attempt,routeMode,errors:[...new Set(errors)],readability:legible,metrics:result.metrics});
    onAttempt?.({candidate,result:{...result,errors,valid:!errors.length},stage:'placement'});
    return {result,errors};
  };
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const random=randomFor(seed+':'+attempt),anchors=placeAnchors(cells,random,scale);
    let candidate={algorithm:'fixed-size-topology-v2',seed,attempt:attempt+1,scale,anchors,routeMode:'approved-curved'};
    let {result,errors}=consider(candidate,'approved-curved');
    if(!errors.length){candidate.paths=deploymentPaths(cells,anchors,scale,random);errors=validatePaths(cells,candidate);trace.at(-1).errors=errors;onAttempt?.({candidate,result:{...result,errors,valid:!errors.length},stage:'paths'});if(!errors.length)return{...candidate,metrics:result.metrics,caps:result.caps,trace};}
    // Repair mapping/travel before considering any reduction in count.
    const repaired=coherentDeployment(cells,anchors,{matching:'baseline',isolatedPadding:0});candidate={...candidate,...repaired};
    ({result,errors}=consider(candidate,repaired.routeMode));last=errors;
    if(!errors.length)return{...candidate,metrics:result.metrics,caps:result.caps,trace};
  }
  const error=new Error('No validated organic deployment: '+last.join(', '));error.diagnostics={classification:readablePlacements?'ALGORITHMIC_ROUTE':'PLACEMENT_SEARCH_EXHAUSTED',trace,attempts:maxAttempts,readablePlacements,bestReadability};throw error;
}

function sourceSignature(cells) {
  return createHash('sha256').update(JSON.stringify(cells.filter(c=>c.count>0).map(c=>[c.date,c.count,c.level,c.x,c.y]))).digest('hex');
}

export function createDeployment(allCells,{seed=randomBytes(16).toString('hex'),maxAttempts=6,baselineAttempts=32,onAttempt,referenceDeployment}={}) {
  if(maxAttempts<1)throw new Error('No validated organic deployment: no-attempts');
  const full=allCells.filter(c=>c.count>0),n=full.length,capacity=estimateCapacity(full),signature=sourceSignature(full),search=[];
  const decorate=(d,selected,mandatoryDates,source)=>{
    const sampling=samplingMetrics(full,selected),quality=qualityGuard(d.anchors,d.caps,{representative:selected.length<n});
    if(!validateSampling(sampling).valid||!quality.valid)throw new Error('Uncertified selection or visual quality');
    const complete=selected.length===n;
    return{...d,seed,sourceSignature:signature,selectedDates:selected.map(c=>c.date),mandatoryDates,totalActiveDays:n,displayedInvaders:selected.length,samplingRatio:n?round(selected.length/n):1,densityMode:complete?'complete':'representative',sampling,quality,search,
      capacity:{...capacity,estimatedMaxReadableInvaders:capacity.maxReadableInvaders,certifiedDisplayedCount:selected.length,maxReadableInvaders:selected.length},
      fullSetIncumbent:complete?{active:n,displayed:n,scale:1,source,sourceSignature:signature,verified:true}:null,
      thinningDisabled:complete,selectionPolicy:complete?'preserve-certified-full-set':'readable-organic-representative',referenceRetained:source==='approved-reference'};
  };
  let reference=null;
  if(referenceDeployment){
    const r=referenceDeployment,dates=new Set(r.selectedDates),selected=full.filter(c=>dates.has(c.date));
    if(r.sourceSignature===signature&&r.seed===seed&&selected.length===r.displayedInvaders){
      const result=validateDeployment(selected,r),quality=qualityGuard(r.anchors,result.caps,{representative:selected.length<n});
      if(result.valid&&quality.valid&&validateSampling(samplingMetrics(full,selected)).valid)reference={...r,caps:result.caps,metrics:result.metrics,quality};
    }
    if(reference&&reference.displayedInvaders===n){search.push({phase:'verified-full-incumbent',requested:n,accepted:true,generated:false});return decorate(reference,full,r.mandatoryDates,'approved-reference');}
  }
  const selectFull=()=>selectRepresentative(full,n,seed+':sample:'+n+':full');
  const tryFull=(phase,build)=>{
    try{
      const d=build(),check=validateDeployment(full,d),quality=qualityGuard(d.anchors,check.caps);
      if(!check.valid||!quality.valid)throw new Error('Full-set result did not pass certification');
      search.push({phase,requested:n,accepted:true,generated:true,attempts:d.attempt,trace:d.trace});
      // Return immediately. No subset, aesthetic refinement or count search can
      // replace a certified readable full-set incumbent in this generation.
      const sample=selectFull();return decorate({...d,caps:check.caps,metrics:check.metrics},full,sample.mandatoryDates,phase);
    }catch(error){
      if(!error.diagnostics)throw error;
      search.push({phase,requested:n,accepted:false,generated:true,...error.diagnostics,reason:error.message});return null;
    }
  };
  if(n<=capacity.diskAreaUpperBound){
    const modern=tryFull('new-full',()=>createFullDeployment(full,{seed,maxAttempts,onAttempt}));if(modern)return modern;
    const baseline=tryFull('baseline-full',()=>createBaselineFullDeployment(full,{seed,maxAttempts:baselineAttempts,onAttempt}));if(baseline)return baseline;
    if(search.some(s=>s.readablePlacements>0)){
      const error=new Error('Readable full-size placement found, but deployment route was not certified; thinning withheld');
      error.diagnostics={classification:'ALGORITHMIC_ROUTE',thinningWithheld:true,capacity,search};throw error;
    }
  }else search.push({phase:'full-capacity-exclusion',requested:n,accepted:false,generated:false,certifiedCapacityExclusion:true,upperBound:capacity.diskAreaUpperBound});
  if(reference){
    const selected=full.filter(c=>reference.selectedDates.includes(c.date));
    search.push({phase:'approved-readable-reference',requested:selected.length,accepted:true,generated:false});
    return decorate(reference,selected,reference.mandatoryDates,'approved-reference');
  }
  // Only after both full-set strategies: favor readable organic density. The
  // approved reference body coverage is ~15.6%; 16% is a representative budget,
  // not a limit on certifiable full sets. Never refine upward just to add icons.
  let target=Math.min(n-1,capacity.diskAreaUpperBound,representativeCountBudget());
  let lastFailure;
  for(let step=0;step<8&&target>=1;step++){
    let sample;
    try{
      for(let draw=0;draw<4;draw++){
        sample=selectRepresentative(full,target,seed+':readable:'+target+(draw?':draw:'+draw:''));if(validateSampling(sample.metrics).valid)break;
      }
      if(!validateSampling(sample.metrics).valid)throw new Error('Sampling topology not preserved');
      const d=createFullDeployment(sample.cells,{seed:seed+':readable-placement:'+target,maxAttempts:Math.min(4,maxAttempts),representative:true,onAttempt});
      search.push({phase:'readable-representative',requested:target,accepted:true,generated:true,trace:d.trace});
      return decorate(d,sample.cells,sample.mandatoryDates,'readable-search');
    }catch(error){
      lastFailure=error;search.push({phase:'readable-representative',requested:target,accepted:false,generated:true,...error.diagnostics,reason:error.message});
      if(error.diagnostics?.readablePlacements>0){const blocked=new Error('Readable placement without certified route; thinning withheld');blocked.diagnostics={classification:'ALGORITHMIC_ROUTE',thinningWithheld:true,search,capacity};throw blocked;}
      target-=Math.max(1,Math.ceil(target*.08));
    }
  }
  const error=new Error('No certified readable representative horde: '+lastFailure?.message);error.diagnostics={classification:'READABLE_SEARCH_EXHAUSTED',search,capacity};throw error;
}
