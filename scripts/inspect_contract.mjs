// Cross-runtime semantic fixture validator, never evaluates JS expressions from fixtures.
import {readFileSync} from 'node:fs';
import {validateDocument,evaluationOrder} from '../packages/cad-core/src/command-engine.mjs';
const docs=JSON.parse(readFileSync(0,'utf8'));
if(!Array.isArray(docs) || docs.length>100) throw new Error('fixture array invalid');
const result=docs.map(doc=>{
  try {validateDocument(doc);return {accepted:true,order:evaluationOrder(doc)};}
  catch(err) {return {accepted:false,code:err.code||'UNKNOWN'};}
});
process.stdout.write(JSON.stringify(result));
