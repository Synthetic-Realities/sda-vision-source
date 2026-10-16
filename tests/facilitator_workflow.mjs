import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const html = await read('frontend/src/facilitator-guide.html');
const handout = await read('docs/Participant_External_Checks.md');
const implementation = await read('frontend/src/components/DemoExternalChecks.tsx');
const instructions = [html, handout, await read('docs/Facilitator_Guide.md'), await read('docs/Workshop_Activities_2026-09-25.md')];
for (const text of instructions) {
  for (const label of ['External checks', 'SynthID results', 'OpenAI results', 'recorded findings']) assert(text.includes(label), label);
  for (const phrase of ['metadata', 'terms', 'charges', 'recorded model scores']) assert(text.includes(phrase), phrase);
  assert.match(text, /session/i);
  assert.doesNotMatch(text, /External checks and second opinions|record the reply, date|Save external check|v1\.6-review/);
}
for (const label of ['SynthID results', 'OpenAI results', 'Open SynthID Detector', 'Open OpenAI checker', 'Download example', 'Download selected image', 'Material for SynthID']) {
  assert(html.includes(label)); assert(handout.includes(label)); assert(implementation.includes(label));
}
assert.match(html, /no upload back into SDA or extra save form/);
assert.match(html, /separate.*recorded model scores/);
assert.match(html, /image examples only/);
assert.match(handout, /same\s+slide when pasting/);
assert.match(handout, /reloading/);
assert.match(html, /previously recorded reply/);
assert.match(html, /one-page participant sheet accompanies this edition/i);
assert.match(html, /Version 1\.7.*16 October 2026/);
assert.doesNotMatch(html, /local review edition|unpublished/i);
for (const match of html.matchAll(/(?:src|href)="((?:guides|branding)\/[^"?#]+)"/g)) {
  await access(new URL(`frontend/public/${match[1]}`, root));
}
for (const name of ['SDA_Vision_Facilitator_Guide_v1.7.pdf', 'SDA_Vision_Participant_Checks_v1.7.pdf']) {
  const source = await readFile(new URL(`docs/guides/${name}`, root));
  assert(source.equals(await readFile(new URL(`frontend/public/guides/${name}`, root))));
}
const page = await read('frontend/facilitator.html');
assert(page.includes('Version 1.7')); assert.doesNotMatch(page, /Version 1\.4|six-page/);
console.log('Facilitator workflow: current labels, prepared-media scope, storage, recipients, exports, release version and linked assets passed.');
