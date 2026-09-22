import fs from 'node:fs';
import crypto from 'node:crypto';
const file=process.argv[2]||'examples/publishing-handoff.example.json';
const secret=process.argv[3]||process.env.PUBLISHING_IMPORT_SECRET;
if(!secret){console.error('Usage: node scripts/sign-publishing-handoff.mjs <json-file> <secret>');process.exit(2)}
const raw=fs.readFileSync(file,'utf8').trim(),ts=Math.floor(Date.now()/1000),sig=crypto.createHmac('sha256',secret).update(`${ts}.${raw}`).digest('hex');
console.log(`x-yasready-publishing-signature: t=${ts},v1=${sig}`);
console.log('\nBody SHA-256:',crypto.createHash('sha256').update(raw).digest('hex'));
console.log('\nPOST /api/integrations/publishing/handoff');
