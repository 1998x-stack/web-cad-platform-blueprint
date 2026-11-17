/** CAD-007 local immutable revision snapshots; not server event sourcing nor collaborative PDM. */
import {validateDocument,hashDocument} from './command-engine.mjs';
const copy=x=>structuredClone(x);
export class LocalCadHistory {
  constructor(initial,limit=32){
    validateDocument(initial);
    if(!Number.isSafeInteger(limit)||limit<2||limit>1024)throw new Error('invalid history limit');
    this.limit=limit;this.snapshots=[copy(initial)];this.cursor=0;
  }
  get current(){return copy(this.snapshots[this.cursor]);}
  get canUndo(){return this.cursor>0;}
  get canRedo(){return this.cursor<this.snapshots.length-1;}
  record(next,{expectedRevision}={}){
    const current=this.snapshots[this.cursor];
    if(expectedRevision!==current.revision)throw Object.assign(new Error('stale history revision'),{code:'REVISION_CONFLICT'});
    validateDocument(next);
    if(next.documentId!==current.documentId||next.units!==current.units||next.revision!==current.revision+1)throw new Error('history requires same document, unit and next revision');
    const candidate=copy(next);
    this.snapshots=this.snapshots.slice(0,this.cursor+1);
    this.snapshots.push(candidate);
    if(this.snapshots.length>this.limit)this.snapshots.shift();
    this.cursor=this.snapshots.length-1;
    return {revision:candidate.revision,hash:hashDocument(candidate)};
  }
  undo(){if(!this.canUndo)return null;this.cursor--;return this.current;}
  redo(){if(!this.canRedo)return null;this.cursor++;return this.current;}
  inspect(){return {index:this.cursor,count:this.snapshots.length,revision:this.snapshots[this.cursor].revision,canUndo:this.canUndo,canRedo:this.canRedo};}
}
