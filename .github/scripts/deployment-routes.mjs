import { region, horizontalGuard, intervalOverlap, invaderGeometry } from './motion-geometry.mjs';
import { components, readable, sourceTopology } from './horde-selection.mjs';
const round=n=>Number(n.toFixed(6));
// Minimum-cost matching stays inside source components; dates are never merged or invented.
function assignment(cost) {
  const n=cost.length,u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
  for(let i=1;i<=n;i++){p[0]=i;let j0=0,minv=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;for(let j=1;j<=n;j++)if(!used[j]){const c=cost[i0-1][j-1]-u[i0]-v[j];if(c<minv[j]){minv[j]=c;way[j]=j0;}if(minv[j]<delta){delta=minv[j];j1=j;}}for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;j0=j1;}while(p[j0]!==0);do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);}
  const a=[];for(let j=1;j<=n;j++)a[p[j]-1]=j-1;return a;
}
export function coherentDeployment(cells,proposal,{matching='component',reverse=false,isolatedPadding=.002}={}) {
  const anchors=structuredClone(proposal),size=12,isolated=new Set(sourceTopology(cells).isolated);
  // Matching uses the actual full-length proposal extent, not the old compressed target.
  const extent=(points,axis)=>[Math.min(...points.map(p=>p[axis])),Math.max(...points.map(p=>p[axis]))];
  const sx=extent(cells,'x'),sy=extent(cells,'y'),tx=extent(proposal,'x'),ty=extent(proposal,'y');
  const map=(v,s,t)=>s[1]>s[0]?t[0]+(v-s[0])/(s[1]-s[0])*(t[1]-t[0]):(t[0]+t[1])/2;
  for(const ids of components(cells)){
    if(matching==='identity')continue;
    const order=matching==='ordered'?[...ids].sort((a,b)=>proposal[a].x-proposal[b].x||proposal[a].y-proposal[b].y):null;
    const sources=order?[...ids].sort((a,b)=>cells[a].x-cells[b].x||cells[a].y-cells[b].y):ids;
    // Baseline replay changes only assignment cost, never the full-length anchors.
    const cost=(i,j)=>matching==='baseline'?(196+.68*(cells[i].x-2)-proposal[j].x)**2+(-10+1.22*(cells[i].y-2)-proposal[j].y)**2:(map(cells[i].x,sx,tx)-proposal[j].x)**2+(map(cells[i].y,sy,ty)-proposal[j].y)**2;
    const a=order||assignment(ids.map(i=>ids.map(j=>cost(i,j)))).map(j=>ids[j]);
    sources.forEach((i,k)=>{anchors[i]={...proposal[a[k]],date:cells[i].date};});
  }
  const bound=p=>{p.x=Math.max(region.left+horizontalGuard,Math.min(region.right-size-horizontalGuard,p.x));p.y=Math.max(region.top+invaderGeometry.verticalAnchorInset,Math.min(region.bottom-size-invaderGeometry.verticalAnchorInset,p.y));};
  const pairs=[];for(let i=0;i<anchors.length;i++)for(let j=i+1;j<anchors.length;j++)pairs.push([i,j]);if(reverse)pairs.reverse();
  // Joint endpoint constraints prevent crossings throughout a common smooth progress.
  // This is a generation solver; the independent continuous validator remains authoritative.
  for(let pass=0;pass<350;pass++){
    let shift=0;
    for(const[i,j]of pairs){
      const p=anchors[i],q=anchors[j],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);
      // Keep certified outliers above the exact 42-unit validator threshold
      // after six-decimal endpoint rounding, not infinitesimally below it.
      const minimum=isolated.has(i)||isolated.has(j)?42+isolatedPadding:readable.minimumSeparation;
      if(d<minimum&&d>1e-6){const f=(minimum-d)*.51;shift=Math.max(shift,f);p.x-=dx/d*f;p.y-=dy/d*f;q.x+=dx/d*f;q.y+=dy/d*f;}
      const a0=cells[i],b0=cells[j],gap=12.16;
      const separated=(b0.x-a0.x>=gap&&q.x-p.x>=gap)||(a0.x-b0.x>=gap&&p.x-q.x>=gap)||(b0.y-a0.y>=gap&&q.y-p.y>=gap)||(a0.y-b0.y>=gap&&p.y-q.y>=gap);
      if(!separated&&intervalOverlap({x:a0.x,y:a0.y,size},{x:p.x,y:p.y,size},{x:b0.x,y:b0.y,size},{x:q.x,y:q.y,size},.16)){
        const options=[];for(const axis of ['x','y']){const original=cells[j][axis]-cells[i][axis];if(Math.abs(original)<12.16)continue;const sign=Math.sign(original),gap=(q[axis]-p[axis])*sign;options.push({axis,sign,push:(12.4-gap)/2});}
        options.sort((a,b)=>a.push-b.push);const {axis,sign,push}=options[0];p[axis]-=push*sign;q[axis]+=push*sign;shift=Math.max(shift,Math.abs(push));
      }
    }
    anchors.forEach(bound);if(shift<.0001)break;
  }
  anchors.forEach(p=>{p.x=round(p.x);p.y=round(p.y);});
  const paths=cells.map((c,i)=>({date:c.date,frames:Array.from({length:65},(_,k)=>{const t=k/64,p=t*t*t*(t*(t*6-15)+10);return{percent:round(t*100),tx:round((anchors[i].x-c.x)*p),ty:round((anchors[i].y-c.y)*p),scale:1};})}));
  return {anchors,paths,routeMode:'component-transport-continuous',matching,reverse};
}

// Bounded alternatives retain the approved 65 CSS knots, duration and scale.
// An axis can lead by 20% of the deployment; every interval is still certified.
export function transportPaths(cells,anchors,mode='synchronous') {
  const smooth=t=>t*t*t*(t*(t*6-15)+10),clamp=t=>Math.max(0,Math.min(1,t));
  return cells.map((c,i)=>({date:c.date,frames:Array.from({length:65},(_,k)=>{
    const t=k/64,lead=smooth(clamp(t/.8)),lag=smooth(clamp((t-.2)/.8)),common=smooth(t);
    const px=mode==='x-first'?lead:mode==='y-first'?lag:common,py=mode==='x-first'?lag:mode==='y-first'?lead:common;
    return{percent:round(t*100),tx:round((anchors[i].x-c.x)*px),ty:round((anchors[i].y-c.y)*py),scale:1};
  })}));
}

export function firstPathConflict(cells,paths) {
  if(!paths)return null;
  for(let k=1;k<65;k++)for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){
    const box=(index,frame)=>({x:cells[index].x+paths[index].frames[frame].tx,y:cells[index].y+paths[index].frames[frame].ty,size:12});
    const a0=box(i,k-1),a1=box(i,k),b0=box(j,k-1),b1=box(j,k);
    if(intervalOverlap(a0,a1,b0,b1,.15))return{dates:[cells[i].date,cells[j].date],interval:[k-1,k],a0,a1,b0,b1};
  }
  return null;
}
