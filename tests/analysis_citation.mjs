import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js';
import React from '../frontend/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../frontend/node_modules/react-dom/server.node.js';
const server=await createServer({root:fileURLToPath(new URL('../frontend',import.meta.url)),configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
 const {default:Extras}=await server.ssrLoadModule('/src/components/Extras.tsx');
 const {default:Queue}=await server.ssrLoadModule('/src/components/BatchQueue.tsx');
 const {buildSessionExport}=await server.ssrLoadModule('/src/sessionExport.ts');
 const {communitySummary}=await server.ssrLoadModule('/src/community.ts');
 const original=JSON.parse(await readFile(new URL('./fixtures/workshop-review/podcast.json',import.meta.url)));
 for(const kind of ['image','audio','video','pdf','pptx','text']) {
  const report=structuredClone(original);report.meta.kind=kind;
  const before=JSON.stringify(report);
  for(const compact of [false,true]) {
   const html=render(React.createElement(Extras,{report,compact}));
   for(const text of ['Martin, S. (2026)','Dr Sam Martin','Smart Data Research UK','UKRI4010','0000-0002-4466-8374',report.meta.generated_at]) assert(html.includes(text));
   if(kind==='audio') assert(html.includes('Transcript-content verdict'));
   if(kind==='video') assert(html.includes('Sampled visual verdict'));
  }
  for(const format of ['md','csv']) assert((await (await buildSessionExport([report],format)).text()).includes('UKRI4010'));
  assert(communitySummary(report,'','',true).includes('UKRI4010'));
  assert.equal(JSON.stringify(report),before);
 }
 const noop=()=>{};
 const queue=render(React.createElement(Queue,{queue:[],examples:[],onExamples:async()=>[],onClear:noop,onAdd:noop,onToggle:noop,onRemove:noop,onSelectAll:noop,onDeselectAll:noop,onRun:noop,busy:false,running:false}));
 assert.match(queue, /^<details class="panel batch-queue">/);
 assert.match(queue, /<summary[^>]*>.*Batch queue/);
 assert.doesNotMatch(queue, /<details[^>]*\bopen/);
 console.log('All media citations, unmodified reports and collapsed batch queue passed.');
} finally {await server.close();}
