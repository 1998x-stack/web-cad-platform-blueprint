import {validateSketch,toPlanegcs,SketchError} from './validation.mjs';
/** Numeric Jacobian rank for the supported P0 constraints. Does not replace planegcs solving. */
export function sketchDegreesOfFreedom(sketch,points,circles){
  const vars=[];
  for(const p of sketch.points){if(!p.fixed){vars.push(`${p.id}.x`,`${p.id}.y`);}}
  for(const c of sketch.circles)vars.push(`${c.id}.radius`);
  const vIndex=new Map(vars.map((id,i)=>[id,i]));const rows=[];
  const row=()=>new Array(vars.length).fill(0);
  const add=(r,id,axis,v)=>{const i=vIndex.get(`${id}.${axis}`);if(i!==undefined)r[i]+=v;};
  for(const c of sketch.constraints){
    if(c.type==='horizontal'||c.type==='vertical'){
      const l=sketch.lines.find(l=>l.id===c.line),a=c.type==='horizontal'?'y':'x';const r=row();add(r,l.end,a,1);add(r,l.start,a,-1);rows.push(r);
    }else if(c.type==='coincident'){
      for(const a of ['x','y']){const r=row();add(r,c.a,a,1);add(r,c.b,a,-1);rows.push(r);}
    }else if(c.type==='distance'){
      const p=points.get(c.a),q=points.get(c.b),dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);if(d<1e-10)continue;
      const r=row();add(r,c.a,'x',dx/d);add(r,c.a,'y',dy/d);add(r,c.b,'x',-dx/d);add(r,c.b,'y',-dy/d);rows.push(r);
    }else if(c.type==='radius'){
      const r=row();add(r,c.circle,'radius',1);rows.push(r);
    }
  }
  const n=vars.length, m=rows.length, eps=1e-8;let rank=0;
  for(let col=0;col<n&&rank<m;col++){
    let pivot=rank;for(let i=rank+1;i<m;i++)if(Math.abs(rows[i][col])>Math.abs(rows[pivot][col]))pivot=i;
    if(Math.abs(rows[pivot][col])<eps)continue;
    [rows[rank],rows[pivot]]=[rows[pivot],rows[rank]];
    const inv=1/rows[rank][col];for(let j=col;j<n;j++)rows[rank][j]*=inv;
    for(let i=rank+1;i<m;i++){let f=rows[i][col];for(let j=col;j<n;j++)rows[i][j]-=f*rows[rank][j];}
    rank++;
  }
  return {degreesOfFreedom:Math.max(0,n-rank),freeVariables:n,independentEquations:rank};
}
function residualReport(sketch,points,circles){
  const byId=new Map(sketch.lines.map(l=>[l.id,l]));const rs=[];
  for(const c of sketch.constraints){
    let err=0;
    if(c.type==='horizontal'||c.type==='vertical'){
      const l=byId.get(c.line),a=points.get(l.start),b=points.get(l.end);err=Math.abs(c.type==='horizontal'?b.y-a.y:b.x-a.x);
    }else if(c.type==='coincident'){
      const a=points.get(c.a),b=points.get(c.b);err=Math.hypot(a.x-b.x,a.y-b.y);
    }else if(c.type==='distance'){
      const a=points.get(c.a),b=points.get(c.b);err=Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-c.value);
    }else if(c.type==='radius'){err=Math.abs(circles.get(c.circle).radius-c.value);}
    rs.push({id:c.id,errorMm:err});
  }
  return {residuals:rs,maxResidualMm:Math.max(0,...rs.map(r=>r.errorMm))};
}
/** Injection-ready wrapper: real planegcs adapter supplied by runtime, never use a fake solver for acceptance. */
export async function solveSketch(sketch,createWrapper,{successStatus,solverBuildId='planegcs-1.3.0'}={}){
  validateSketch(sketch);
  const {primitives,reverse}=toPlanegcs(sketch);
  // Deterministic diagnostic for directly contradictory dimensions (not a WASM success claim).
  const dimensions=new Map();
  for(const c of sketch.constraints.filter(c=>c.type==='distance')){
    const key=[c.a,c.b].sort().join(':');
    const prior=dimensions.get(key);
    if(prior && Math.abs(prior.value-c.value)>1e-7){
      return {schemaVersion:1,sketchId:sketch.sketchId,sourceRevision:sketch.revision,solverBuildId,status:'conflicting',valid:false,degreesOfFreedom:null,conflicts:[prior.id,c.id],redundantConstraints:[],partiallyRedundantConstraints:[],points:[],circles:[],maxResidualMm:null,diagnosticSource:'preflight'};
    }
    dimensions.set(key,c);
  }
  const solver=await createWrapper();
  try{
    solver.set_max_iterations?.(150);
    solver.set_convergence_threshold?.(1e-10);
    solver.push_primitives_and_params(primitives);
    const s=solver.solve();
    const conflicts=(solver.get_gcs_conflicting_constraints?.()??[]).map(id=>reverse.get(String(id))).filter(Boolean);
    const redundants=(solver.get_gcs_redundant_constraints?.()??[]).map(id=>reverse.get(String(id))).filter(Boolean);
    const partial=(solver.get_gcs_partially_redundant_constraints?.()??[]).map(id=>reverse.get(String(id))).filter(Boolean);
    if(s!==successStatus||conflicts.length||redundants.length||partial.length){
      return {schemaVersion:1,sketchId:sketch.sketchId,sourceRevision:sketch.revision,solverBuildId,status:'conflicting',valid:false,degreesOfFreedom:null,conflicts,redundantConstraints:redundants,partiallyRedundantConstraints:partial,points:[],circles:[],maxResidualMm:null};
    }
    solver.apply_solution();
    const solution=solver.sketch_index.get_primitives();const byId=new Map(solution.map(p=>[String(p.id),p]));
    const forward=new Map([...reverse].map(([num,id])=>[id,num]));
    const points=sketch.points.map(p=>{const r=byId.get(forward.get(p.id));if(!r||!Number.isFinite(r.x)||!Number.isFinite(r.y))throw new SketchError('SOLVER_INVALID','nonfinite solved point');return {...p,x:r.x,y:r.y};});
    const circles=sketch.circles.map(c=>{const r=byId.get(forward.get(c.id));if(!r||!Number.isFinite(r.radius)||r.radius<=0)throw new SketchError('SOLVER_INVALID','invalid solved radius');return {...c,radius:r.radius};});
    const pointMap=new Map(points.map(p=>[p.id,p])),circleMap=new Map(circles.map(c=>[c.id,c]));
    const residual=residualReport(sketch,pointMap,circleMap);
    if(residual.maxResidualMm>1e-5){return {schemaVersion:1,sketchId:sketch.sketchId,sourceRevision:sketch.revision,solverBuildId,status:'conflicting',valid:false,degreesOfFreedom:null,conflicts:residual.residuals.filter(x=>x.errorMm>1e-5).map(x=>x.id),redundantConstraints:[],partiallyRedundantConstraints:[],points:[],circles:[],maxResidualMm:residual.maxResidualMm};}
    const {degreesOfFreedom,freeVariables,independentEquations}=sketchDegreesOfFreedom(sketch,pointMap,circleMap);
    return {schemaVersion:1,sketchId:sketch.sketchId,sourceRevision:sketch.revision,solverBuildId,status:degreesOfFreedom>0?'underconstrained':'fully_constrained',valid:true,degreesOfFreedom,freeVariables,independentEquations,conflicts:[],redundantConstraints:[],partiallyRedundantConstraints:[],points,circles,maxResidualMm:residual.maxResidualMm};
  }catch(err){if(err instanceof SketchError)throw err;throw new SketchError('SOLVER_FAILURE',String(err?.message||err).slice(0,400));}
  finally{solver.destroy_gcs_module();}
}
/** Build exact B-Rep rectangle from a solver result: limited to 4-line orthogonal loops. */
export function solvedRectangleToCadDocument(sketch,result,heightMm=30){
  validateSketch(sketch);
  if(!result||!result.valid||result.status!=='fully_constrained'||result.sourceRevision!==sketch.revision)throw new SketchError('UNSOLVED_PROFILE','fully constrained current sketch required');
  if(sketch.lines.length!==4||sketch.circles.length)throw new SketchError('UNSUPPORTED_PROFILE','P0 supports 4-line rectangular closed profile only');
  const pts=new Map(result.points.map(p=>[p.id,p]));
  const lines=sketch.lines;
  const loop=[lines[0].start,lines[0].end];let pos=loop[1];const unused=new Set(lines.slice(1).map(l=>l.id));
  while(unused.size){const next=lines.find(l=>unused.has(l.id)&&(l.start===pos||l.end===pos));if(!next)throw new SketchError('OPEN_PROFILE','segments do not make continuous loop');unused.delete(next.id);pos=next.start===pos?next.end:next.start;loop.push(pos);}
  if(loop[4]!==loop[0]||new Set(loop.slice(0,4)).size!==4)throw new SketchError('OPEN_PROFILE','profile must close exactly once');
  const coords=loop.slice(0,4).map(id=>pts.get(id));if(coords.some(p=>!p))throw new SketchError('INVALID_PROFILE','missing solved points');
  const xs=coords.map(p=>p.x),ys=coords.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=maxX-minX,depth=maxY-minY;
  if(!Number.isFinite(heightMm)||heightMm<=0||heightMm>1e6||width<1e-4||depth<1e-4)throw new SketchError('INVALID_PROFILE','invalid extrusion dimension');
  // reject bow ties, duplicates and non-axis aligned profiles even when a bounding box could be constructed
  const corners=new Set(coords.map(p=>`${Math.abs(p.x-minX)<1e-5?0:Math.abs(p.x-maxX)<1e-5?1:'X'},${Math.abs(p.y-minY)<1e-5?0:Math.abs(p.y-maxY)<1e-5?1:'X'}`));
  if(corners.size!==4||[...corners].some(c=>c.includes('X')))throw new SketchError('UNSUPPORTED_PROFILE','only orthogonal rectangles are supported');
  for(let i=0;i<4;i++){
    const a=coords[i],b=coords[(i+1)%4];
    const dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
    if((dx<1e-5&&dy<1e-5)||(dx>1e-5&&dy>1e-5))throw new SketchError('UNSUPPORTED_PROFILE','diagonals and zero-length edges are not supported');
  }
  return {schemaVersion:1,documentId:`${sketch.sketchId}_Solid`,revision:sketch.revision,units:'mm',parameters:{},features:[{id:'SketchRectangleExtrusion',type:'box',inputs:[],originMm:[minX,minY,0],sizeMm:[width,depth,heightMm]}],outputBodyId:'SketchRectangleExtrusion'};
}
