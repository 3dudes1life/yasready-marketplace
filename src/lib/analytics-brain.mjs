const num=v=>Number(v)||0;
const round=(v,d=2)=>Number(num(v).toFixed(d));
const safeDiv=(a,b)=>b?num(a)/num(b):0;

export function percentChange(current,previous){
  current=num(current);previous=num(previous);
  if(previous===0) return current===0?0:null;
  return round(((current-previous)/Math.abs(previous))*100,1);
}

export function contributionEconomics(totals={},marketingSpendMinor=0){
  const gross=num(totals.grossSalesMinor);
  const refunds=num(totals.refundsMinor);
  const marketplaceFees=num(totals.marketplaceFeesMinor);
  const processorFees=num(totals.processorFeesMinor);
  const fulfillmentCost=num(totals.fulfillmentCostMinor);
  const trackedMarketingSpend=Math.max(0,num(marketingSpendMinor));
  const contributionMinor=gross-refunds-marketplaceFees-processorFees-fulfillmentCost-trackedMarketingSpend;
  return {
    grossMinor:gross,refundsMinor:refunds,marketplaceFeesMinor:marketplaceFees,processorFeesMinor:processorFees,
    fulfillmentCostMinor:fulfillmentCost,marketingSpendMinor:trackedMarketingSpend,contributionMinor,
    contributionMargin:gross?round(contributionMinor/gross*100,1):0,
    refundRate:gross?round(refunds/gross*100,2):0,
    fulfillmentRate:gross?round(fulfillmentCost/gross*100,2):0
  };
}

export function comparePeriods(current={},previous={}){
  const keys=['grossSalesMinor','orders','units','views','conversionRate','refundsMinor','sellerPayableMinor'];
  const changes={};for(const k of keys)changes[k]=percentChange(current[k],previous[k]);
  return {current,previous,changes};
}

export function formatConcentration(formats=[]){
  const rows=formats.map(x=>({format:x.format,units:num(x.units),grossMinor:num(x.grossMinor)}));
  const total=rows.reduce((s,x)=>s+x.grossMinor,0);
  const ranked=rows.map(x=>({...x,share:total?round(x.grossMinor/total*100,1):0})).sort((a,b)=>b.grossMinor-a.grossMinor);
  return {totalGrossMinor:total,formats:ranked,top:ranked[0]||null};
}

export function dailyTrend(rows=[]){
  const values=rows.map(x=>num(x.grossMinor??x.value));
  if(!values.length)return {direction:'flat',changePct:0,averageMinor:0,latestMinor:0,anomaly:null};
  const cut=Math.max(1,Math.floor(values.length/3));
  const first=values.slice(0,cut),last=values.slice(-cut);
  const avg=a=>a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
  const a=avg(first),b=avg(last),change=percentChange(b,a);
  const direction=change===null?'up':change>10?'up':change<-10?'down':'flat';
  let anomaly=null;
  if(values.length>=7){
    const baseline=values.slice(0,-1),mean=avg(baseline),variance=avg(baseline.map(v=>(v-mean)**2)),sd=Math.sqrt(variance),latest=values.at(-1);
    if(sd>0&&latest>mean+2*sd) anomaly={type:'spike',latestMinor:latest,baselineMinor:Math.round(mean),z:round((latest-mean)/sd,2)};
    else if(sd>0&&latest<Math.max(0,mean-2*sd)) anomaly={type:'drop',latestMinor:latest,baselineMinor:Math.round(mean),z:round((latest-mean)/sd,2)};
  }
  return {direction,changePct:change??100,averageMinor:Math.round(avg(values)),latestMinor:values.at(-1),anomaly};
}

export function bookEconomics(rows=[]){
  return rows.map(r=>{
    const gross=num(r.grossMinor),refunds=num(r.refundsMinor),marketplace=num(r.marketplaceFeesMinor),processor=num(r.processorFeesMinor),fulfillment=num(r.fulfillmentCostMinor);
    const contribution=gross-refunds-marketplace-processor-fulfillment;
    return {...r,grossMinor:gross,refundsMinor:refunds,marketplaceFeesMinor:marketplace,processorFeesMinor:processor,fulfillmentCostMinor:fulfillment,contributionMinor:contribution,contributionMargin:gross?round(contribution/gross*100,1):0};
  }).sort((a,b)=>b.contributionMinor-a.contributionMinor);
}

export function buildSignals({current={},previous={},economics={},formats=[],marketing=null,trend=null,books=[]}={}){
  const signals=[];
  const push=(key,category,severity,title,detail,evidence={})=>signals.push({key,category,severity,title,detail,evidence});
  const grossChange=percentChange(current.grossSalesMinor,previous.grossSalesMinor);
  const convChange=percentChange(current.conversionRate,previous.conversionRate);
  if(num(current.orders)===0&&num(current.views)>=25) push('traffic-no-orders','conversion','attention','Traffic is arriving, but no orders are closing',`${current.views} tracked listing visits produced no paid orders in this period. Check the listing promise, format availability and price before sending more traffic.`,{views:current.views,orders:current.orders});
  if(grossChange!==null&&grossChange>=15&&num(current.grossSalesMinor)>=5000) push('revenue-up','sales','positive','Sales are moving up',`Gross Marketplace revenue is up ${grossChange}% versus the previous comparable period.`,{changePct:grossChange,grossMinor:current.grossSalesMinor});
  if(grossChange!==null&&grossChange<=-20&&num(previous.grossSalesMinor)>=5000) push('revenue-down','sales','attention','Revenue has cooled',`Gross Marketplace revenue is down ${Math.abs(grossChange)}% versus the previous comparable period. Look at traffic, conversion and campaign mix before changing price.`,{changePct:grossChange});
  if(convChange!==null&&convChange<=-20&&num(current.views)>=50) push('conversion-down','conversion','attention','Conversion is slipping',`Conversion is ${current.conversionRate}% and has fallen ${Math.abs(convChange)}% versus the prior period.`,{current:current.conversionRate,previous:previous.conversionRate,changePct:convChange});
  if(num(economics.refundRate)>=5&&num(current.orders)>=5) push('refund-rate','quality','warning','Refunds deserve a look',`${economics.refundRate}% of gross Marketplace revenue was refunded in this period.`,{refundRate:economics.refundRate,refundsMinor:economics.refundsMinor});
  if(num(economics.fulfillmentRate)>=30&&num(current.grossSalesMinor)>0) push('fulfillment-pressure','margin','attention','Print fulfillment is eating into direct-sale economics',`Tracked fulfillment cost is ${economics.fulfillmentRate}% of gross revenue. Review print pricing and edition mix before discounting physical books.`,{fulfillmentRate:economics.fulfillmentRate});
  const fmt=formatConcentration(formats);if(fmt.top&&fmt.top.share>=70&&num(fmt.top.units)>=10)push('format-concentration','mix','info',`${fmt.top.format} is carrying the catalog`,`${fmt.top.share}% of Marketplace revenue is coming from ${fmt.top.format}. That is useful demand signal, but it also means the catalog is concentrated in one format.`,{format:fmt.top.format,share:fmt.top.share});
  if(marketing?.campaigns?.length){
    const costed=marketing.campaigns.filter(x=>num(x.costMinor)>0&&num(x.visits)>=20).sort((a,b)=>num(b.roas)-num(a.roas));
    const win=costed.find(x=>num(x.roas)>=3&&num(x.orders)>=3);if(win)push(`campaign-win:${win.id||win.campaignId||win.name}`,'marketing','positive',`${win.name||win.source} is earning its spend`,`${win.roas}× tracked ROAS with ${win.orders} attributed orders. Reuse the winning message before increasing complexity.`,{roas:win.roas,orders:win.orders,source:win.source});
    const weak=costed.find(x=>num(x.roas)<1&&num(x.visits)>=50);if(weak)push(`campaign-weak:${weak.id||weak.campaignId||weak.name}`,'marketing','warning',`${weak.name||weak.source} is not paying back tracked spend`,`${weak.visits} tracked visits produced ${weak.roas}× ROAS. Pause spend or change the landing message before adding budget.`,{roas:weak.roas,visits:weak.visits,costMinor:weak.costMinor});
  }
  if(trend?.anomaly?.type==='spike')push('daily-spike','trend','positive','A sales spike just appeared',`The latest day is materially above the recent baseline. Check attribution before the signal fades so you know what caused it.`,trend.anomaly);
  if(trend?.anomaly?.type==='drop')push('daily-drop','trend','attention','The latest day dropped below the recent baseline',`The latest day is materially below the recent daily baseline. Confirm this is not a tracking or availability problem before reacting to it.`,trend.anomaly);
  if(books.length>=2){const top=books[0],bottom=[...books].sort((a,b)=>a.contributionMargin-b.contributionMargin)[0];if(top&&bottom&&top.bookId!==bottom.bookId&&top.contributionMinor>0)push('book-economics','margin','info',`${top.title} is contributing the most direct-sale dollars`,`${top.title} produced the strongest tracked contribution in this period. ${bottom.title} has the lowest tracked contribution margin at ${bottom.contributionMargin}%.`,{topBookId:top.bookId,bottomBookId:bottom.bookId});}
  if(!signals.length)push('collect-more','system','info','Keep collecting clean signal','Nothing needs urgent attention yet. Keep campaigns separated and let Marketplace collect enough visits, orders and cost data to make stronger comparisons.',{});
  const rank={warning:0,attention:1,positive:2,info:3};return signals.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9));
}

export function buildAnalyticsBrain({current={},previous={},formats=[],marketing=null,daily=[],books=[]}={}){
  const marketingSpendMinor=num(marketing?.costMinor||marketing?.totals?.costMinor||0);
  const economics=contributionEconomics(current,marketingSpendMinor);
  const comparison=comparePeriods(current,previous);
  const formatMix=formatConcentration(formats);
  const trend=dailyTrend(daily);
  const bookRows=bookEconomics(books);
  const signals=buildSignals({current,previous,economics,formats,marketing,trend,books:bookRows});
  return {version:'yasready.analytics.brain.v1',generatedAt:new Date().toISOString(),current,previous,comparison,economics,formatMix,trend,daily,books:bookRows,signals,attention:signals[0]};
}

export function subtractStats(wide={},current={}){
  const numeric=['orders','units','grossSalesMinor','marketplaceFeesMinor','processorFeesMinor','fulfillmentCostMinor','refundsMinor','disputedMinor','transferredMinor','sellerPayableMinor','views'];
  const out={currency:current.currency||wide.currency||'usd'};for(const k of numeric)out[k]=Math.max(0,num(wide[k])-num(current[k]));
  out.conversionRate=out.views?round(out.orders/out.views*100,2):0;return out;
}

export function subtractFormats(wide=[],current=[]){
  const c=new Map(current.map(x=>[String(x.format).toLowerCase(),x]));return wide.map(w=>{const x=c.get(String(w.format).toLowerCase())||{};return {format:w.format,units:Math.max(0,num(w.units)-num(x.units)),grossMinor:Math.max(0,num(w.grossMinor)-num(x.grossMinor))}}).filter(x=>x.units||x.grossMinor);
}
