import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=read('src/main.js');
const css=read('src/styles.css');
const html=read('index.html');
const pkg=JSON.parse(read('package.json'));

const checks=[
  ['package version is 0.14.0',()=>assert.equal(pkg.version,'0.14.0')],
  ['public storefront chrome exists',()=>assert.match(main,/publicChrome/)],
  ['creator left rail exists',()=>assert.match(main,/yrSidebar/)],
  ['creator utility bar exists',()=>assert.match(main,/yrTopbar/)],
  ['mobile creator nav exists',()=>assert.match(main,/yrMobileNav/)],
  ['creator views receive creator-ui body mode',()=>assert.match(main,/classList\.toggle\('creator-ui'/)],
  ['workspace navigation is grouped',()=>{for(const x of ['Workspace','Grow','Operations'])assert.match(main,new RegExp(x))}],
  ['shared YasReady mark is used',()=>assert.match(main,/yasready-mark\.png/)],
  ['mark exists in raw Pages root',()=>assert.ok(fs.existsSync(new URL('../yasready-mark.png',import.meta.url)))],
  ['mark exists in Vite public assets',()=>assert.ok(fs.existsSync(new URL('../public/yasready-mark.png',import.meta.url)))],
  ['author content clears sidebar',()=>assert.match(css,/\.creator-ui \.creatorView\{margin-left:var\(--yr-sidebar\)/)],
  ['mobile layout removes desktop rail',()=>assert.match(css,/\.yrSidebar\{display:none\}/)],
  ['loading state exists',()=>assert.match(main,/function loadingState/)],
  ['error state exists',()=>assert.match(main,/function errorState/)],
  ['reduced motion is respected',()=>assert.match(css,/prefers-reduced-motion:reduce/)],
  ['YasReady green remains operating accent',()=>assert.match(css,/--yr-green:#16815c/)],
  ['Ready Lime remains status signal',()=>assert.match(css,/--yr-brand:#C6FF00/)],
  ['theme preference prepaints before app',()=>assert.ok(html.indexOf('yasready-theme')<html.indexOf('<div id="app">'))],
  ['GitHub Pages relative bootstrap retained',()=>assert.match(html,/src="\.\/src\/main\.js"/)],
  ['release label appears in UI',()=>assert.match(main,/v0\.14\.0/)]
];

let passed=0;
for(const [name,run] of checks){
  try{run();passed++;console.log(`PASS: ${name}`)}catch(err){console.error(`FAIL: ${name}`);throw err}
}
console.log(`PASS: ${passed}/${checks.length} v0.14 UI Closure regression checks`);
