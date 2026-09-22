import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=read('src/main.js'),worker=read('src/worker.mjs'),css=read('src/styles.css'),sql=read('migrations/0011_marketing_studio.sql'),engine=read('src/lib/marketing-studio.mjs');
const pkg=JSON.parse(read('package.json'));
const checks=[
 ['package version is 0.10.0',()=>assert.equal(pkg.version,'0.10.0')],
 ['Marketing Studio release label exists',()=>assert.match(main,/v0\.10\.0 · Analytics Brain/)],
 ['campaign builder has objective and spend',()=>{assert.match(main,/campaignObjective/);assert.match(main,/campaignBudget/)}],
 ['launch kit exists in UI',()=>assert.match(main,/LAUNCH KIT/)],
 ['campaign performance shows conversion and ROAS',()=>{assert.match(main,/Conv\./);assert.match(main,/ROAS/)}],
 ['evidence based signal exists',()=>assert.match(main,/YASREADY SIGNAL/)],
 ['marketing studio API exists',()=>assert.match(worker,/\/api\/me\/marketing-studio\//)],
 ['short link redirect exists',()=>assert.match(worker,/marketingShortRedirect/)],
 ['campaign costs are persisted',()=>assert.match(sql,/marketing_campaign_costs/)],
 ['short links are persisted',()=>assert.match(sql,/marketing_short_links/)],
 ['launch kits are persisted',()=>assert.match(sql,/marketing_launch_kits/)],
 ['recommendation table is reserved',()=>assert.match(sql,/marketing_recommendations/)],
 ['engine calculates campaign metrics',()=>assert.match(engine,/function campaignMetrics/)],
 ['engine provides recommendations',()=>assert.match(engine,/function marketingRecommendation/)],
 ['marketing studio styles exist',()=>assert.match(css,/\.marketingInsight/)],
 ['mobile Marketing Studio closure exists',()=>assert.match(css,/\.marketingInsight\{align-items:flex-start/)]
];
let passed=0;for(const [name,run] of checks){try{run();passed++;console.log(`PASS: ${name}`)}catch(e){console.error(`FAIL: ${name}`);throw e}}
console.log(`PASS: ${passed}/${checks.length} Marketing Studio checks`);
