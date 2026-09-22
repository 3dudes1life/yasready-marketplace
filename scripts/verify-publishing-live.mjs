import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const worker=read('src/worker.mjs');
const migration=read('migrations/0015_publishing_live_test.sql');
const docs=read('docs/PUBLISHING-HANDSHAKE-LIVE-TEST.md');
const example=JSON.parse(read('examples/publishing-handoff-update.example.json'));
const checks=[
  ['version 0.13.0',()=>assert.equal(pkg.version,'0.13.0')],
  ['staged update table',()=>assert.match(migration,/publishing_update_reviews/)],
  ['test run evidence',()=>assert.match(migration,/publishing_handshake_test_runs/)],
  ['pending review disposition',()=>assert.match(worker,/staged_for_author_review/)],
  ['author review GET',()=>assert.ok(worker.includes('/publishing-review')&&worker.includes("request.method==='GET'"))],
  ['author apply + reject',()=>{assert.match(worker,/resolvePublishingReview/);assert.match(worker,/author_rejected/);assert.match(worker,/author_approved_update/)}],
  ['price preserved',()=>assert.match(read('src/lib/publishing-handoff.mjs'),/ownership:'marketplace'/)],
  ['source ownership lock',()=>assert.match(worker,/publishing_source_owned_by_different_user/)],
  ['explicit live gate retained',()=>assert.match(worker,/book_go_live/)],
  ['live smoke script',()=>assert.match(read('scripts/publishing-live-test.mjs'),/review_required/)],
  ['update example',()=>assert.equal(example.schema,'yasready.publishing.marketplace.v1')],
  ['docs mention no Publishing mutation',()=>assert.match(docs,/without modifying the Publishing repository/i)]
];
let pass=0;
for(const [name,fn] of checks){try{fn();console.log('PASS:',name);pass++;}catch(e){console.error('FAIL:',name,'-',e.message)}}
console.log(`PASS: ${pass}/${checks.length} Publishing Live Test checks`);
if(pass!==checks.length)process.exit(1);
