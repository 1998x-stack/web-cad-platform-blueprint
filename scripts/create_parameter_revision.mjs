// Demonstrates that one typed command changes a parameter, not a feature literal.
import {readFileSync,writeFileSync} from 'node:fs';
import {previewTransaction} from '../packages/cad-core/src/command-engine.mjs';
const source=JSON.parse(readFileSync('samples/precision-block.cad.json','utf8'));
const preview=previewTransaction(source,{
  transactionId:'radius_to_6',expectedRevision:source.revision,
  commands:[{op:'parameter.set',name:'holeRadius',kind:'length',value:6}]
});
process.stdout.write(JSON.stringify(preview.candidateDocument,null,2)+'\n');
