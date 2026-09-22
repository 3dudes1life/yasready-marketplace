import fs from 'node:fs';
import assert from 'node:assert/strict';

const styles=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

const checks=[
  ['shared visual parity marker',()=>assert.match(styles,/YASREADY UI CLOSURE/)],
  ['canonical Ready Lime',()=>assert.match(styles,/--yr-brand:#C6FF00/)],
  ['canonical operating green',()=>assert.match(styles,/--yr-green:#16815c/)],
  ['canonical light surface',()=>assert.match(styles,/--yr-bg:#f4f5f8/)],
  ['canonical dark surface',()=>assert.match(styles,/--yr-bg:#07090e/)],
  ['green YasReady primary action',()=>assert.match(styles,/linear-gradient\(120deg,#127351,#1e9a6b\)/)],
  ['shared exact mark asset',()=>assert.match(main,/yasready-mark\.png/)],
  ['public and author shells are distinct',()=>{assert.match(main,/publicChrome/);assert.match(main,/yrSidebar/)}],
  ['compact author control rail',()=>assert.match(styles,/--yr-sidebar:224px/)],
  ['shared appearance control',()=>assert.match(main,/yr-shared-theme-toggle/)],
  ['same theme preference key',()=>{assert.match(main,/yasready-theme/);assert.match(html,/yasready-theme/)}],
  ['prepaint theme applied before app',()=>assert.ok(html.indexOf('yasready-theme')<html.indexOf('<div id="app">'))],
  ['Marketplace remains product-named',()=>assert.match(main,/Marketplace <span class="brandDot">\|<\/span> YasReady/)],
  ['lime stays a readiness signal',()=>assert.match(styles,/moneyLock[^}]*var\(--yr-brand\)/s)],
  ['mobile author shell is explicit',()=>assert.match(styles,/\.yrMobileNav\{position:fixed;display:flex/)],
  ['loading states use shared panel grammar',()=>{assert.match(main,/loadingState/);assert.match(styles,/\.stateCard/)}]
];

let passed=0;
for(const [name,run] of checks){
  try{run();passed++;console.log(`✓ ${name}`)}catch(err){console.error(`✗ ${name}`);throw err}
}
console.log(`\nYasReady visual parity verification passed · ${passed}/${checks.length}`);
