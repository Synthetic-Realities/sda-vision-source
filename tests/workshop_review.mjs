import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import React from '../frontend/node_modules/react/index.js';
import { renderToStaticMarkup as render } from '../frontend/node_modules/react-dom/server.node.js';
const server=await createServer({root:fileURLToPath(new URL('../frontend',import.meta.url)),configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
 const mod=async name=>(await server.ssrLoadModule(`/src/components/${name}.tsx`)).default;
 const [Activity,Banner,Credential,Sound,Queue]=await Promise.all(['WorkshopActivity','ConsensusBanner','CredentialSummary','AudioPanel','BatchQueue'].map(mod));
 const {emptyWorkshopResponses}=await server.ssrLoadModule('/src/workshop.ts');
 const {ratingBasis,confidenceBasis}=await server.ssrLoadModule('/src/assessmentNotes.ts');
 const {communitySummary}=await server.ssrLoadModule('/src/community.ts');
 const podcast=JSON.parse(await readFile(new URL('./fixtures/workshop-review/podcast.json',import.meta.url)));
 const starter=JSON.parse(await readFile(new URL('./fixtures/workshop-review/illustration_1.json',import.meta.url)));
 const noop=()=>{};
 const responses={...emptyWorkshopResponses(),noticeNote:'Hands <not a tag>',discussionNote:'We compared the shadows.',impression:['Photo'],laterImpression:['Made with AI'],clues:['Small visual details']};
 const props={kind:'image',report:starter,busy:false,responses,onChange:noop,onNext:noop,onPrevious:noop,onReviewChecks:noop,onEndSession:noop,onNewSession:noop,onViewEvidence:noop,sessionStatus:''};
 const discuss=render(React.createElement(Activity,{...props,step:'discuss'}));
 assert.match(discuss,/Your Notice note/);assert.match(discuss,/Hands &lt;not a tag&gt;/);assert.match(discuss,/What did you notice or talk about/);
 assert(discuss.indexOf('You picked')>discuss.indexOf("check together"));
 const reflect=render(React.createElement(Activity,{...props,step:'reflect'}));
 assert.match(reflect,/<legend>Your view now<\/legend>/);assert.match(reflect,/Your Discuss note/);assert.match(reflect,/Download session notes/);
 assert(reflect.indexOf('Your view has moved') > reflect.indexOf('What would you do next? Choose any.'));
 assert(reflect.indexOf('Your view has moved') < reflect.indexOf('What will you take away? (optional)'));
 assert(reflect.indexOf('Your view has moved') < reflect.indexOf('New session'));
 const before=JSON.stringify(podcast); const banner=render(React.createElement(Banner,{report:podcast}));
 assert.match(banner,/Transcript excerpt assessment/);assert.match(banner,/12,000/);assert.match(banner,/25,985/);assert.match(banner,/46%/);assert.match(banner,/Text synthetic rating: 90/);assert.match(banner,/Median of the available model ratings/);assert.doesNotMatch(banner,/class="gauge"/);
 assert.doesNotMatch(banner,/Combined method confidence|recorded rule assigns/);assert.equal(JSON.stringify(podcast),before);
 const signed=render(React.createElement(Credential,{report:starter})); assert.match(signed,/declares AI-generated/);assert.match(signed,/OpenAI/);assert.match(signed,/yet to establish trust/);assert.match(signed,/no approved signer-trust policy/);
 for(const integrity of ['absent','invalid','unknown']) {
  const r=structuredClone(starter);const p=r.providers.find(p=>p.id==='c2pa');p.raw.validation.integrity=integrity;
  const html=render(React.createElement(Credential,{report:r}));assert(!html.includes('passed their technical checks'));
 }
 for(const status of ['error','timeout','pending','unconfigured','disabled']) {
  const r=structuredClone(starter);r.providers.find(p=>p.id==='c2pa').status=status;
  const html=render(React.createElement(Credential,{report:r}));assert(!html.includes('declares AI-generated'));assert(!html.includes('passed their technical checks'));
 }
 const noModels=structuredClone(podcast);noModels.providers=[];noModels.consensus.confidence='low';noModels.consensus.overall_verdict='inconclusive';noModels.consensus.overall_rating=null;noModels.consensus.score_basis='not_scored';noModels.consensus.decision_trace=[];
 assert.match(render(React.createElement(Banner,{report:noModels})),/No transcript model checks/);
 assert.equal(ratingBasis({...podcast.consensus,score_basis:'mean_frame_ratings'}),'Mean of the assessed frame ratings');
 assert(!ratingBasis({...podcast.consensus,score_basis:undefined}).includes('Median'));
 assert(!confidenceBasis({...podcast.consensus,decision_trace:[]}).includes('three models'));
 assert.match(render(React.createElement(Sound,{report:podcast})),/20s/);assert.match(render(React.createElement(Sound,{report:podcast})),/Download this sound-check record/);
 assert.equal(podcast.audio_assessment.synthetic_audio_assessed,false);
 const summary=communitySummary(podcast,'','',true,responses);assert.match(summary,/46%/);assert.doesNotMatch(summary,/combined method confidence|recorded rule assigns/);assert.match(summary,/Soundtrack/);
 console.log('Workshop review: carried notes, feedback placement, transcript scope/coverage, score basis, confidence, credential failure states, sound record and summary export passed.');
} finally {await server.close();}
