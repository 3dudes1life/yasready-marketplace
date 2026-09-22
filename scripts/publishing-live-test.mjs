import {createHmac,randomUUID} from 'node:crypto';
import fs from 'node:fs';

const base=(process.env.MARKETPLACE_TEST_URL||'http://127.0.0.1:8787').replace(/\/$/,'');
const secret=process.env.PUBLISHING_IMPORT_SECRET;
if(!secret){console.error('PUBLISHING_IMPORT_SECRET is required.');process.exit(2)}
const template=JSON.parse(fs.readFileSync(new URL('../examples/publishing-handoff.example.json',import.meta.url),'utf8'));
const stamp=Date.now();
const sourceBookId=`publishing-live-test-${stamp}`;
const initial={...template,sourceBookId,sourceRevision:`live-test-${stamp}-r1`,sentAt:new Date().toISOString(),book:{...template.book,title:`YasReady Handshake Test ${stamp}`,suggestedSlug:`yasready-handshake-test-${stamp}`},editions:template.editions.map((e,i)=>({...e,sourceEditionId:`${sourceBookId}-edition-${i+1}`}))};
const sign=body=>{const ts=Math.floor(Date.now()/1000);const raw=JSON.stringify(body);const sig=createHmac('sha256',secret).update(`${ts}.${raw}`).digest('hex');return {raw,header:`t=${ts},v1=${sig}`}};
async function handoff(body){const {raw,header}=sign(body);const r=await fetch(`${base}/api/integrations/publishing/handoff`,{method:'POST',headers:{'content-type':'application/json','x-yasready-publishing-signature':header},body:raw});const d=await r.json();if(!r.ok)throw new Error(`handoff ${r.status}: ${JSON.stringify(d)}`);return d}
async function api(path,init={}){const r=await fetch(base+path,{...init,headers:{'content-type':'application/json',accept:'application/json',...(init.headers||{})}});const d=await r.json();if(!r.ok)throw new Error(`${path} ${r.status}: ${JSON.stringify(d)}`);return d}
const results=[];const check=(name,ok,evidence={})=>{results.push({name,ok,evidence});console.log(`${ok?'PASS':'FAIL'}: ${name}`);if(!ok)throw new Error(name)};

const status=await api('/api/integrations/publishing/status');check('publishing receiver enabled',status.liveImportEnabled===true,status);
const first=await handoff(initial);check('first package creates draft',first.created===true&&first.status==='applied',first);
const replay=await handoff(initial);check('identical package replays safely',replay.replayed===true,replay);
const update={...initial,sourceRevision:`live-test-${stamp}-r2`,sentAt:new Date().toISOString(),book:{...initial.book,subtitle:'Revision Two — staged for author review'},editions:initial.editions.map((e,i)=>({...e,suggestedPriceMinor:i===1?2499:e.suggestedPriceMinor,artifactHash:e.artifactHash?`${e.artifactHash}-r2`:e.artifactHash}))};
const staged=await handoff(update);check('existing-book update is staged',staged.status==='review_required'&&!!staged.reviewId,staged);
const review=await api(`/api/me/books/${encodeURIComponent(first.bookId)}/publishing-review`);check('review diff is visible',review.review?.status==='pending'&&Array.isArray(review.review?.diff),review.review);
check('marketplace price change is preserved',review.review.diff.some(x=>x.fieldName==='priceMinor'&&x.disposition==='preserved'),{diff:review.review.diff});
const applied=await api(`/api/me/books/${encodeURIComponent(first.bookId)}/publishing-review/${encodeURIComponent(staged.reviewId)}/apply`,{method:'POST',body:JSON.stringify({note:'v0.13 automated live-test approval'})});check('author can approve staged production update',applied.status==='applied',applied);
const readiness=await api(`/api/me/books/${encodeURIComponent(first.bookId)}/readiness`);check('sale readiness is evaluated after sync',typeof readiness.readiness?.ready==='boolean',readiness.readiness);
if(readiness.readiness.ready){const live=await api(`/api/me/books/${encodeURIComponent(first.bookId)}/go-live`,{method:'POST',body:JSON.stringify({editionIds:readiness.readiness.eligibleEditionIds})});check('author launch gate can make eligible editions live',live.status==='live',live)}
console.log(JSON.stringify({ok:true,sourceBookId,bookId:first.bookId,results},null,2));
