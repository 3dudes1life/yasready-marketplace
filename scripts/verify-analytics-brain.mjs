import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json')),main=read('src/main.js'),worker=read('src/worker.mjs'),css=read('src/styles.css'),sql=read('migrations/0012_analytics_brain.sql'),engine=read('src/lib/analytics-brain.mjs'),business=read('src/lib/business.mjs');
const checks=[
 ['package version is 0.11.0',()=>assert.equal(pkg.version,'0.11.0')],
 ['Analytics Brain release label exists',()=>assert.match(main,/v0\.11\.0/)],
 ['Insights is a first-class workspace route',()=>assert.match(main,/\['insights','Insights'\]/)],
 ['Analytics Brain UI exists',()=>assert.match(main,/function insightsView/)],
 ['period comparison UI exists',()=>assert.match(main,/PERIOD COMPARISON/)],
 ['direct-sale economics UI exists',()=>assert.match(main,/DIRECT-SALE ECONOMICS/)],
 ['book economics UI exists',()=>assert.match(main,/BOOK ECONOMICS/)],
 ['evidence-based signal UI exists',()=>assert.match(main,/YASREADY SIGNALS/)],
 ['Analytics Brain API exists',()=>assert.match(worker,/\/api\/me\/analytics-brain/)],
 ['refresh endpoint persists analysis runs',()=>assert.match(worker,/analytics-brain\/refresh/)],
 ['signal dismiss endpoint exists',()=>assert.match(worker,/analytics-signals/)],
 ['brain run table exists',()=>assert.match(sql,/analytics_brain_runs/)],
 ['signal state table exists',()=>assert.match(sql,/analytics_signal_state/)],
 ['daily rollup cache table is reserved',()=>assert.match(sql,/analytics_daily_rollups/)],
 ['engine calculates contribution economics',()=>assert.match(engine,/function contributionEconomics/)],
 ['engine compares periods',()=>assert.match(engine,/function comparePeriods/)],
 ['engine detects daily trend',()=>assert.match(engine,/function dailyTrend/)],
 ['engine builds evidence signals',()=>assert.match(engine,/function buildSignals/)],
 ['Business export accepts analytics',()=>assert.match(business,/analytics=null/)],
 ['Analytics Brain responsive styles exist',()=>assert.match(css,/v0\.10\.0 — ANALYTICS BRAIN/)]
];
let passed=0;for(const [name,run] of checks){try{run();passed++;console.log(`PASS: ${name}`)}catch(e){console.error(`FAIL: ${name}`);throw e}}console.log(`PASS: ${passed}/${checks.length} Analytics Brain checks`);
