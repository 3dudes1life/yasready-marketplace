import fs from 'node:fs';
const required=['dist/index.html','src/worker.mjs','migrations/0001_foundation.sql','docs/ARCHITECTURE.md','docs/PROVIDER-INTEGRATIONS.md'];
for(const p of required){if(!fs.existsSync(p)) throw new Error(`Missing ${p}`)}
const html=fs.readFileSync('dist/index.html','utf8');if(!/Marketplace \| YasReady/.test(html)) throw new Error('Brand title missing');
console.log('✅ Marketplace | YasReady v0.1.0 verified: static build + API foundation + D1 schema present.');
