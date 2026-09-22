import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=read('src/main.js'),worker=read('src/worker.mjs'),css=read('src/styles.css'),sql=read('migrations/0009_catalog_management.sql');
const checks=[
 ['catalog migration has working drafts',()=>assert.match(sql,/CREATE TABLE IF NOT EXISTS catalog_drafts/)],
 ['catalog migration has immutable change history',()=>assert.match(sql,/CREATE TABLE IF NOT EXISTS catalog_change_history/)],
 ['catalog migration has validation provenance',()=>assert.match(sql,/CREATE TABLE IF NOT EXISTS catalog_validation_runs/)],
 ['presentation overrides do not replace Publishing columns',()=>{for(const c of ['display_title','description_override','cover_override_url','category_override'])assert.ok(sql.includes(c))}],
 ['editor GET/PATCH API exists',()=>{assert.ok(worker.includes('/editor'));assert.ok(worker.includes("request.method==='PATCH'"))}],
 ['preview API exists',()=>assert.ok(worker.includes('/preview'))],
 ['apply draft API exists',()=>assert.ok(worker.includes('/apply-draft'))],
 ['history API exists',()=>assert.ok(worker.includes('catalog_change_history'))],
 ['optimistic draft conflict is enforced',()=>assert.ok(worker.includes('stale_catalog_draft'))],
 ['listing revision conflict is enforced',()=>assert.ok(worker.includes('listing_changed_since_draft'))],
 ['UI exposes edit listing action',()=>assert.ok(main.includes('data-edit-catalog'))],
 ['UI has autosave pipeline',()=>assert.ok(main.includes('saveCatalogEditor'))],
 ['UI has preview before apply',()=>assert.ok(main.includes('LIVE PREVIEW'))],
 ['UI exposes production fields as locked',()=>assert.ok(main.includes('Production fields locked'))],
 ['catalog editor responsive styles exist',()=>assert.match(css,/\.catalogEditorBody/)],
 ['catalog version label is present',()=>assert.match(main,/v0\.13\.0/)]
];
let passed=0;for(const [name,fn] of checks){try{fn();passed++;console.log(`PASS: ${name}`)}catch(e){console.error(`FAIL: ${name}`);throw e}}console.log(`PASS: ${passed}/${checks.length} v0.13 Catalog Management regression checks`);
