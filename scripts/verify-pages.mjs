import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const index=read('index.html'),main=read('src/main.js'),analytics=read('src/lib/analytics.js'),notFound=read('404.html');
const checks=[
  ['relative module bootstrap',index.includes('src="./src/main.js"')],
  ['source stylesheet linked in HTML',index.includes('href="./src/styles.css"')],
  ['native browser does not import CSS from JS',!main.includes("import './styles.css'")],
  ['QR dependency is lazy so it cannot blank the storefront',!main.startsWith("import QRCode")&&main.includes('async function renderQr')],
  ['native import.meta is guarded',analytics.includes('import.meta.env?.VITE_MARKETPLACE_MODE')],
  ['Pages campaign URL keeps project path',analytics.includes("location.hostname.endsWith('.github.io')")],
  ['deep-link fallback exists',notFound.includes("/yasready-marketplace/")]
];
let bad=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'}: ${name}`);if(!ok)bad++;}if(bad)process.exit(1);console.log(`PASS: ${checks.length}/${checks.length} GitHub Pages checks`);
