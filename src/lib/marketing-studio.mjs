const CHANNELS={
  instagram:{medium:'social',label:'Instagram'},facebook:{medium:'social',label:'Facebook'},tiktok:{medium:'social',label:'TikTok'},youtube:{medium:'video',label:'YouTube'},email:{medium:'email',label:'Email / newsletter'},'event-qr':{medium:'offline',label:'Event / QR'},'author-site':{medium:'referral',label:'Author website'},press:{medium:'earned',label:'Press / review'},other:{medium:'referral',label:'Other'}
};
const OBJECTIVES=new Set(['launch','sales','awareness','reviews','event','evergreen']);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
export function channelConfig(source='other'){return CHANNELS[source]||CHANNELS.other}
export function normalizeCampaignDraft(input={}){
  const source=String(input.source||'other').toLowerCase();
  const objective=OBJECTIVES.has(input.objective)?input.objective:'sales';
  return {name:String(input.name||'Campaign').trim().slice(0,120),source,medium:String(input.medium||channelConfig(source).medium).slice(0,80),objective,budgetMinor:Math.max(0,Math.round(Number(input.budgetMinor)||0)),startsAt:input.startsAt||null,endsAt:input.endsAt||null,notes:String(input.notes||'').slice(0,1000)};
}
export function campaignMetrics({visits=0,orders=0,revenueMinor=0,costMinor=0,refundsMinor=0}={}){
  visits=Math.max(0,Number(visits)||0);orders=Math.max(0,Number(orders)||0);revenueMinor=Math.max(0,Number(revenueMinor)||0);costMinor=Math.max(0,Number(costMinor)||0);refundsMinor=Math.max(0,Number(refundsMinor)||0);
  const netRevenueMinor=Math.max(0,revenueMinor-refundsMinor);
  return {visits,orders,revenueMinor,costMinor,refundsMinor,netRevenueMinor,conversionRate:visits?Number((orders/visits*100).toFixed(2)):0,revenuePerVisitMinor:visits?Math.round(netRevenueMinor/visits):0,roas:costMinor?Number((netRevenueMinor/costMinor).toFixed(2)):null};
}
export function rankChannels(rows=[]){return [...rows].map(r=>({...r,...campaignMetrics(r)})).sort((a,b)=>(b.netRevenueMinor-a.netRevenueMinor)||(b.orders-a.orders)||(b.visits-a.visits));}
export function marketingRecommendation(rows=[]){
  const ranked=rankChannels(rows); if(!ranked.length)return {type:'collect_data',title:'Start with one trackable campaign',detail:'Create a YasReady campaign link or QR code so Marketplace can connect visits to orders.'};
  const best=ranked[0];
  if(best.orders>=3&&best.conversionRate>=6)return {type:'scale_winner',title:`Keep leaning into ${best.label||best.source}`,detail:`It is converting at ${best.conversionRate}% across ${best.visits} tracked visits. Reuse the winning message before adding another channel.`,source:best.source};
  const traffic=[...ranked].sort((a,b)=>b.visits-a.visits)[0];
  if(traffic&&traffic.visits>=100&&traffic.conversionRate<2)return {type:'fix_conversion',title:`${traffic.label||traffic.source} brings traffic, not enough buyers`,detail:`${traffic.visits} visits are converting at ${traffic.conversionRate}%. Try a clearer format/price callout or send readers to a stronger campaign-specific message.`,source:traffic.source};
  return {type:'keep_testing',title:'Keep campaigns separate',detail:'You have enough signal to compare channels. Keep each QR/link unique so the next sale teaches you something.'};
}
export function launchKit({title,author,url,objective='launch'}={}){
  const safeTitle=String(title||'Your book'),safeAuthor=String(author||'the author');
  return {
    social:{launch:`${safeTitle} by ${safeAuthor} is available now. Choose your format: ${url}`,short:`Read or listen to ${safeTitle}: ${url}`,behindScenes:`The book is finished. Now it gets to find its readers. ${safeTitle}: ${url}`},
    email:{subject:`${safeTitle} is available now`,preheader:`Choose how you want to read or listen.`,body:`${safeTitle} by ${safeAuthor} is now available. Choose your preferred format and see the book here: ${url}`},
    event:{headline:`Read ${safeTitle}`,subhead:'Scan to see every available format.',cta:'Scan to read, listen or order'},
    checklist: objective==='launch'?['Verify every live format and price','Create one launch campaign link','Create one QR for printed/event use','Post launch announcement','Send reader email','Check attribution after 48 hours']:['Create a dedicated campaign','Use one clear CTA','Share in one channel','Review conversion before changing the message']
  };
}
export function shortLinkSlug(name='book',seed=''){
  const base=String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'book';
  const suffix=String(seed||'').replace(/[^a-z0-9]/gi,'').toLowerCase().slice(0,6)||Math.random().toString(36).slice(2,8);
  return `${base}-${suffix}`;
}
export function assetPlan({source='instagram',objective='launch'}={}){
  const channel=channelConfig(source); const core=['trackable_link','qr_code','website_button'];
  if(channel.medium==='email')core.push('email_copy'); else if(channel.medium==='offline')core.push('event_card'); else core.push('social_copy');
  if(objective==='launch')core.push('launch_checklist');
  return [...new Set(core)];
}
