import fs from 'node:fs';
import assert from 'node:assert/strict';

const styles=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

const checks=[
  ['shared visual parity marker',()=>assert.match(styles,/EXACT YASREADY PLATFORM VISUAL PARITY/)],
  ['canonical Ready Lime',()=>assert.match(styles,/--yr-brand:#C6FF00/)],
  ['canonical operating green',()=>assert.match(styles,/--yr-green:#16815c/)],
  ['canonical light surface',()=>assert.match(styles,/--yr-bg:#f4f5f8/)],
  ['canonical dark surface',()=>assert.match(styles,/--yr-bg:#07090e/)],
  ['green YasReady primary action',()=>assert.match(styles,/linear-gradient\(120deg,#127351,#1e9a6b\)/)],
  ['compact 64px platform shell',()=>assert.match(styles,/\.nav\{height:64px!important/)],
  ['shared appearance control',()=>assert.match(main,/yr-shared-theme-toggle/)],
  ['same theme preference key',()=>{assert.match(main,/yasready-theme/);assert.match(html,/yasready-theme/)}],
  ['prepaint theme applied before app',()=>assert.ok(html.indexOf('yasready-theme')<html.indexOf('<div id="app">'))],
  ['Marketplace remains product-named',()=>assert.match(main,/Marketplace <span class="brandDot">\|<\/span> YasReady/)],
  ['lime stays a readiness signal',()=>assert.match(styles,/safePill[^}]*var\(--yr-brand\)/s)]
];

let passed=0;
for(const [name,run] of checks){
  try{run();passed++;console.log(`✓ ${name}`)}catch(err){console.error(`✗ ${name}`);throw err}
}
console.log(`\nYasReady visual parity verification passed · ${passed}/${checks.length}`);
