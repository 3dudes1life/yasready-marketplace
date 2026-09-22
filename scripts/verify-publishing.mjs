import fs from 'node:fs';
import {normalizePublishingHandoff,readinessForSale,PUBLISHING_HANDOFF_SCHEMA} from '../src/lib/publishing-handoff.mjs';
const raw=JSON.parse(fs.readFileSync(new URL('../examples/publishing-handoff.example.json',import.meta.url),'utf8'));
const p=normalizePublishingHandoff(raw);
const checks=[];
checks.push(['schema',p.schema===PUBLISHING_HANDOFF_SCHEMA]);
checks.push(['shared user',p.userId==='demo-user-william']);
checks.push(['four editions',p.editions.length===4]);
checks.push(['physical ISBN normalized',p.editions.find(x=>x.format==='paperback')?.isbn==='9780000000012']);
const ready=readinessForSale({book:{title:p.book.title,cover_url:p.book.coverUrl},listing:{status:'draft'},editions:p.editions.filter(x=>x.productionStatus==='ready').map((e,i)=>({id:`e${i}`,format:e.format,isbn:e.isbn,price_minor:e.suggestedPriceMinor,production_status:e.productionStatus,artifact_ref:e.artifactRef})),author:{}});
checks.push(['readiness engine',ready.ready===true]);
const migration=fs.readFileSync(new URL('../migrations/0008_publishing_handshake.sql',import.meta.url),'utf8');
checks.push(['provenance schema',/publishing_sync_changes/.test(migration)&&/marketplace_launch_events/.test(migration)]);
const worker=fs.readFileSync(new URL('../src/worker.mjs',import.meta.url),'utf8');
checks.push(['signed endpoint',worker.includes('/api/integrations/publishing/handoff')&&worker.includes('verifyPublishingSignature')]);
checks.push(['author launch gate',worker.includes('go-live')&&worker.includes('author_approved_at')]);
let pass=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'}: ${name}`);if(ok)pass++;}
console.log(`PASS: ${pass}/${checks.length} Publishing Handshake checks`);if(pass!==checks.length)process.exit(1);
