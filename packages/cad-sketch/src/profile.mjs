/** CAD-007: verified, single closed linear loop, no holes or self-intersections. */
import {SketchError,validateSketch} from './validation.mjs';
const EPS=1e-7, MAX=1e6;
function fail(code,message){throw new SketchError(code,message)}
function orient(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function between(a,b,c){return Math.min(a,b)-EPS<=c&&c<=Math.max(a,b)+EPS;}
function onSegment(a,b,p){return Math.abs(orient(a,b,p))<EPS && between(a[0],b[0],p[0])&&between(a[1],b[1],p[1]);}
function segmentsIntersect(a,b,c,d){
  const p=orient(a,b,c),q=orient(a,b,d),r=orient(c,d,a),s=orient(c,d,b);
  if ((p>EPS&&q< -EPS||p< -EPS&&q>EPS)&&(r>EPS&&s< -EPS||r< -EPS&&s>EPS))return true;
  return (Math.abs(p)<EPS&&onSegment(a,b,c))||(Math.abs(q)<EPS&&onSegment(a,b,d))||(Math.abs(r)<EPS&&onSegment(c,d,a))||(Math.abs(s)<EPS&&onSegment(c,d,b));
}
export function validateClosedProfile(pointsMm){
  if(!Array.isArray(pointsMm)||pointsMm.length<3||pointsMm.length>128)fail('INVALID_PROFILE','3..128 XY vertices required');
  const pts=pointsMm.map((p,i)=>{
    if(!Array.isArray(p)||p.length!==2||!p.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=MAX))fail('INVALID_PROFILE',`vertex[${i}] invalid`);
    return [...p];
  });
  for(let i=0;i<pts.length;i++)if(Math.hypot(pts[i][0]-pts[(i+1)%pts.length][0],pts[i][1]-pts[(i+1)%pts.length][1])<EPS)fail('DEGENERATE_PROFILE','zero-length edge');
  // Nonadjacent edges may not intersect or touch (including collinear overlaps).
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
    if(j===i+1||(i===0&&j===pts.length-1))continue;
    if(segmentsIntersect(pts[i],pts[(i+1)%pts.length],pts[j],pts[(j+1)%pts.length]))fail('SELF_INTERSECTION',`edges ${i} and ${j} intersect`);
  }
  let doubleArea=0;
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];doubleArea+=a[0]*b[1]-a[1]*b[0];}
  if(Math.abs(doubleArea)<1e-8)fail('DEGENERATE_PROFILE','profile area must be nonzero');
  return {pointsMm:pts,signedAreaMm2:doubleArea/2,areaMm2:Math.abs(doubleArea)/2};
}
export function extractClosedProfile(sketch,solved){
  validateSketch(sketch);
  if(!solved||!solved.valid||solved.status!=='fully_constrained'||solved.sourceRevision!==sketch.revision||solved.sketchId!==sketch.sketchId)fail('UNSOLVED_PROFILE','current fully constrained sketch required');
  if(sketch.circles.length||sketch.lines.length<3||sketch.lines.length>128)fail('UNSUPPORTED_PROFILE','single line-only closed loop required; circles and holes unsupported');
  if(!Array.isArray(solved.points)||solved.points.length!==sketch.points.length)fail('INVALID_PROFILE','solver returned unexpected point count');
  const pts=new Map(solved.points.map(p=>[p.id,p]));
  if(pts.size!==sketch.points.length)fail('INVALID_PROFILE','solver duplicated vertex IDs');
  if(sketch.lines.length!==pts.size)fail('OPEN_PROFILE','one simple cycle must reference every point');
  const neighbors=new Map();
  for(const l of sketch.lines){
    for(const [a,b] of [[l.start,l.end],[l.end,l.start]]){
      if(!neighbors.has(a))neighbors.set(a,[]);
      neighbors.get(a).push(b);
    }
  }
  for(const [k,items] of neighbors)if(items.length!==2||items[0]===items[1])fail('NON_MANIFOLD_PROFILE',`point ${k} must have exactly two distinct incident edges`);
  if(neighbors.size!==pts.size)fail('OPEN_PROFILE','isolated point in sketch');
  const start=[...neighbors.keys()].sort()[0];let prev=null,cur=start;const walk=[];
  do {
    if(walk.includes(cur))fail('OPEN_PROFILE','cycle revisits vertex');
    walk.push(cur);
    const choices=[...neighbors.get(cur)].sort();const next=choices.find(v=>v!==prev);
    prev=cur;cur=next;
  }while(cur!==start && walk.length<=sketch.lines.length);
  if(cur!==start||walk.length!==sketch.lines.length)fail('OPEN_PROFILE','multiple loops or disconnected edges');
  const xy=walk.map(id=>{const p=pts.get(id);if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))fail('INVALID_PROFILE','missing solved coordinates');return [p.x,p.y]});
  const profile=validateClosedProfile(xy);
  // Stable orientation of the derived B-Rep face: CCW on XY.
  if(profile.signedAreaMm2<0){const [first,...rest]=xy;xy.splice(0,xy.length,first,...rest.reverse());}
  return validateClosedProfile(xy);
}
/** Converts a successful solver result into an explicit profile + extrude feature DAG. */
export function solvedProfileToCadDocument(sketch,solved,heightMm=30){
  if(typeof heightMm!=='number'||!Number.isFinite(heightMm)||heightMm<=0||heightMm>MAX)fail('INVALID_DIMENSION','heightMm must be in (0,1e6]');
  const {pointsMm}=extractClosedProfile(sketch,solved);
  return {
    schemaVersion:1,documentId:`${sketch.sketchId}_Solid`,revision:sketch.revision,units:'mm',
    parameters:{extrusionDepth:{kind:'length',value:heightMm}},
    features:[
      {id:'SolvedProfile',type:'profile',inputs:[],plane:'XY',sourceSketchId:sketch.sketchId,sourceSketchRevision:sketch.revision,pointsMm},
      {id:'ExtrudedSolid',type:'extrude',inputs:['SolvedProfile'],distanceMm:{parameterRef:'extrusionDepth'}}
    ],outputBodyId:'ExtrudedSolid'
  };
}
