import test from 'node:test';
import assert from 'node:assert/strict';
import {percentChange,contributionEconomics,comparePeriods,formatConcentration,dailyTrend,bookEconomics,buildSignals,buildAnalyticsBrain,subtractStats,subtractFormats} from '../src/lib/analytics-brain.mjs';

test('percentChange handles normal, flat and new values',()=>{
  assert.equal(percentChange(120,100),20);
  assert.equal(percentChange(100,100),0);
  assert.equal(percentChange(0,0),0);
  assert.equal(percentChange(10,0),null);
});

test('contribution economics subtract tracked selling costs without calling it company profit',()=>{
  const e=contributionEconomics({grossSalesMinor:10000,refundsMinor:500,marketplaceFeesMinor:500,processorFeesMinor:300,fulfillmentCostMinor:2000},700);
  assert.equal(e.contributionMinor,6000);
  assert.equal(e.contributionMargin,60);
  assert.equal(e.refundRate,5);
});

test('period subtraction creates an adjacent previous period from a wider window',()=>{
  const prev=subtractStats({orders:30,units:40,grossSalesMinor:30000,views:1000},{orders:20,units:25,grossSalesMinor:20000,views:600});
  assert.equal(prev.orders,10);assert.equal(prev.units,15);assert.equal(prev.grossSalesMinor,10000);assert.equal(prev.views,400);assert.equal(prev.conversionRate,2.5);
});

test('format subtraction is keyed by format',()=>{
  const out=subtractFormats([{format:'Paperback',units:20,grossMinor:20000},{format:'Ebook',units:10,grossMinor:5000}],[{format:'Paperback',units:12,grossMinor:12000}]);
  assert.deepEqual(out,[{format:'Paperback',units:8,grossMinor:8000},{format:'Ebook',units:10,grossMinor:5000}]);
});

test('format concentration identifies the dominant format',()=>{
  const x=formatConcentration([{format:'Paperback',units:20,grossMinor:8000},{format:'Ebook',units:20,grossMinor:2000}]);
  assert.equal(x.top.format,'Paperback');assert.equal(x.top.share,80);
});

test('daily trend finds rising momentum and an outlier spike',()=>{
  const rows=[10,10,11,9,10,11,10,10,11,10,40].map((grossMinor,i)=>({date:String(i),grossMinor}));
  const t=dailyTrend(rows);assert.equal(t.direction,'up');assert.equal(t.anomaly.type,'spike');
});

test('book economics sorts by tracked contribution dollars',()=>{
  const rows=bookEconomics([{bookId:'a',title:'A',grossMinor:10000,refundsMinor:0,marketplaceFeesMinor:500,processorFeesMinor:300,fulfillmentCostMinor:2000},{bookId:'b',title:'B',grossMinor:9000,refundsMinor:0,marketplaceFeesMinor:450,processorFeesMinor:270,fulfillmentCostMinor:500}]);
  assert.equal(rows[0].bookId,'b');assert.ok(rows[0].contributionMinor>rows[1].contributionMinor);
});

test('signals use evidence and can flag revenue growth, format concentration and paid campaign efficiency',()=>{
  const signals=buildSignals({current:{grossSalesMinor:15000,orders:12,views:200,conversionRate:6},previous:{grossSalesMinor:10000,orders:8,views:180,conversionRate:4.44},economics:{refundRate:0,fulfillmentRate:10},formats:[{format:'Paperback',units:12,grossMinor:12000},{format:'Ebook',units:4,grossMinor:3000}],marketing:{campaigns:[{id:'x',name:'Event QR',source:'event-qr',visits:100,orders:8,costMinor:1000,roas:5}]},trend:{direction:'up',anomaly:null},books:[]});
  const keys=signals.map(x=>x.key);assert.ok(keys.includes('revenue-up'));assert.ok(keys.includes('format-concentration'));assert.ok(keys.some(k=>k.startsWith('campaign-win:')));
});

test('full brain returns comparison, economics, format mix, trend, books and attention',()=>{
  const brain=buildAnalyticsBrain({current:{grossSalesMinor:20000,orders:10,units:12,views:200,conversionRate:5,refundsMinor:500,marketplaceFeesMinor:1000,processorFeesMinor:600,fulfillmentCostMinor:3000},previous:{grossSalesMinor:15000,orders:8,units:9,views:180,conversionRate:4.44},formats:[{format:'Paperback',units:8,grossMinor:14000},{format:'Ebook',units:4,grossMinor:6000}],marketing:{costMinor:1000,campaigns:[]},daily:[{grossMinor:1000},{grossMinor:1200},{grossMinor:1600}],books:[{bookId:'a',title:'A',orders:10,units:12,grossMinor:20000,refundsMinor:500,marketplaceFeesMinor:1000,processorFeesMinor:600,fulfillmentCostMinor:3000}]});
  assert.equal(brain.version,'yasready.analytics.brain.v1');assert.ok(brain.comparison);assert.ok(brain.economics);assert.ok(brain.formatMix);assert.ok(brain.trend);assert.equal(brain.books.length,1);assert.ok(brain.attention);
});

test('Business export can carry Analytics Brain without changing money units',async()=>{
  const {buildBusinessExport}=await import('../src/lib/business.mjs');
  const out=buildBusinessExport({author:{id:'a',userId:'u',displayName:'Author'},period:{days:30},totals:{grossSalesMinor:10000},analytics:{version:'yasready.analytics.brain.v1',economics:{contributionMinor:7000}}});
  assert.equal(out.totals.grossSalesMinor,10000);
  assert.equal(out.analytics.economics.contributionMinor,7000);
});
