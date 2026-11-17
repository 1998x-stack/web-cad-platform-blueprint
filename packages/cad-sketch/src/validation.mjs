/** CAD-006 v1 strict 2D sketch contract; mm, XY plane, IDs stable across runtimes. */
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const MAX = 1e6;
export class SketchError extends Error {
  constructor(code,message){super(message);this.name='SketchError';this.code=code;}
}
function requireValue(ok,code,message){if(!ok)throw new SketchError(code,message);}
function only(value,keys,label){requireValue(value && typeof value==='object'&&!Array.isArray(value) && Object.keys(value).every(k=>keys.includes(k)),'INVALID_SKETCH',`${label}: unexpected fields`)}
function validId(s){return typeof s==='string' && ID.test(s) && !['__proto__','constructor','prototype'].includes(s)}
function finite(s){return typeof s==='number'&&Number.isFinite(s)}
function length(n){return finite(n)&&n>0&&n<=MAX}
/** Throws with an explicit error code; does not mutate caller-owned inputs. */
export function validateSketch(sketch){
  only(sketch,['schemaVersion','sketchId','revision','units','plane','points','lines','circles','constraints'],'sketch');
  requireValue(sketch.schemaVersion===1&&validId(sketch.sketchId)&&Number.isSafeInteger(sketch.revision)&&sketch.revision>=0&&sketch.units==='mm'&&sketch.plane==='XY','INVALID_SKETCH','requires SketchDocumentV1 with XY/mm and valid IDs');
  requireValue(Array.isArray(sketch.points)&&sketch.points.length>=1&&sketch.points.length<=128,'INVALID_SKETCH','1..128 points required');
  requireValue(Array.isArray(sketch.lines)&&sketch.lines.length<=128&&Array.isArray(sketch.circles)&&sketch.circles.length<=32,'INVALID_SKETCH','bounded lines/circles arrays required');
  requireValue(Array.isArray(sketch.constraints)&&sketch.constraints.length<=256,'INVALID_SKETCH','0..256 constraints required');
  const ids=new Set(),points=new Map(),lines=new Map(),circles=new Map();
  function unique(s){requireValue(validId(s)&&!ids.has(s),'DUPLICATE_ID',`invalid or duplicate ID ${s}`);ids.add(s)}
  for(const p of sketch.points){only(p,['id','x','y','fixed'],'point');unique(p.id);requireValue(finite(p.x)&&finite(p.y)&&Math.abs(p.x)<=MAX&&Math.abs(p.y)<=MAX&&typeof p.fixed==='boolean','INVALID_POINT',`${p.id}: bounded XY and fixed required`);points.set(p.id,p)}
  for(const l of sketch.lines){only(l,['id','start','end'],'line');unique(l.id);requireValue(points.has(l.start)&&points.has(l.end)&&l.start!==l.end,'INVALID_LINE',`${l.id}: line endpoints must be distinct existing point IDs`);lines.set(l.id,l)}
  for(const c of sketch.circles){only(c,['id','center','radius'],'circle');unique(c.id);requireValue(points.has(c.center)&&length(c.radius),'INVALID_CIRCLE',`${c.id}: center and positive radius required`);circles.set(c.id,c)}
  for(const c of sketch.constraints){
    requireValue(c && typeof c==='object','INVALID_CONSTRAINT','constraint must be object');unique(c.id);
    switch(c.type){
      case 'horizontal':case 'vertical':
        only(c,['id','type','line'],'constraint');requireValue(lines.has(c.line),'INVALID_CONSTRAINT',`${c.id}: unknown line`);break;
      case 'coincident':
        only(c,['id','type','a','b'],'constraint');requireValue(points.has(c.a)&&points.has(c.b)&&c.a!==c.b,'INVALID_CONSTRAINT',`${c.id}: unknown/distinct points required`);break;
      case 'distance':
        only(c,['id','type','a','b','value'],'constraint');requireValue(points.has(c.a)&&points.has(c.b)&&c.a!==c.b&&length(c.value),'INVALID_CONSTRAINT',`${c.id}: positive length and distinct points required`);break;
      case 'radius':
        only(c,['id','type','circle','value'],'constraint');requireValue(circles.has(c.circle)&&length(c.value),'INVALID_CONSTRAINT',`${c.id}: circle and positive radius required`);break;
      default:throw new SketchError('UNSUPPORTED_CONSTRAINT',`${c.id}: unsupported constraint type ${c.type}`);
    }
  }
  return {points,lines,circles};
}
/** Produce stable numeric planegcs IDs: points first, then curves, then constraints. */
export function toPlanegcs(sketch){
  const {points,lines,circles}=validateSketch(sketch);
  const map=new Map(),reverse=new Map(),primitives=[];
  const add=(o,make)=>{const id=String(primitives.length+1);map.set(o.id,id);reverse.set(id,o.id);primitives.push(make(id));};
  for(const p of sketch.points)add(p,id=>({id,type:'point',x:p.x,y:p.y,fixed:p.fixed}));
  for(const l of sketch.lines)add(l,id=>({id,type:'line',p1_id:map.get(l.start),p2_id:map.get(l.end)}));
  for(const c of sketch.circles)add(c,id=>({id,type:'circle',c_id:map.get(c.center),radius:c.radius}));
  for(const c of sketch.constraints){
    add(c,id=>{
      if(c.type==='horizontal'||c.type==='vertical'){
        const l=lines.get(c.line), prop=c.type==='horizontal'?'y':'x';
        return {id,type:'equal',param1:{o_id:map.get(l.start),prop},param2:{o_id:map.get(l.end),prop}};
      }
      if(c.type==='coincident')return {id,type:'p2p_coincident',p1_id:map.get(c.a),p2_id:map.get(c.b)};
      if(c.type==='distance')return {id,type:'p2p_distance',p1_id:map.get(c.a),p2_id:map.get(c.b),distance:c.value};
      if(c.type==='radius')return {id,type:'equal',param1:{o_id:map.get(c.circle),prop:'radius'},param2:c.value};
      throw new SketchError('UNSUPPORTED_CONSTRAINT',c.type);
    });
  }
  return {primitives,map,reverse,points,lines,circles};
}
