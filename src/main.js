import {account as demoAccount,books as demoBooks,dashboard as demoDashboard,campaigns as demoCampaigns} from './data/demo.js';
import {track,campaignUrl} from './lib/analytics.js';
import {authFetch} from './lib/session-client.js';

const app=document.querySelector('#app');
const state={
  view:'store',filter:'All',query:'',selected:null,
  cart:JSON.parse(localStorage.getItem('yr.market.cart.v2')||'[]'),
  account:{...demoAccount},books:[...demoBooks],dashboard:{...demoDashboard},campaigns:[...demoCampaigns],
  api:false,loading:false,marketingBookId:'taul-2',campaignName:'Launch campaign',campaignSource:'instagram',campaignMedium:'social'
};

const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const moneyMinor=n=>money((Number(n)||0)/100);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const liveEditions=b=>b.editions.filter(e=>e.status==='live');
const minPrice=b=>Math.min(...liveEditions(b).map(e=>e.price));
const myBooks=()=>state.books.filter(b=>b.authorId===state.account.authorId);
const max=(arr)=>Math.max(1,...arr.map(Number));
const formatLabel=f=>({ebook:'Ebook',paperback:'Paperback',hardcover:'Hardcover',audiobook:'Audiobook'}[String(f).toLowerCase()]||f);

const brandMark=`<span class="brandMark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 10h12l8 15 8-15h12L37 36v17H27V36z" fill="white"/><circle cx="50" cy="49" r="5.5" fill="#dfff78"/></svg></span>`;

async function renderQr(canvas,url){
  try{
    const mod=location.hostname.endsWith('.github.io')?await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm'):await import('qrcode');
    const qr=mod.default||mod;return await qr.toCanvas(canvas,url,{width:250,margin:1,errorCorrectionLevel:'M'});
  }catch{
    canvas.width=250;canvas.height=250;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,250,250);ctx.fillStyle='#1d1d1f';ctx.font='700 14px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';ctx.textAlign='center';ctx.fillText('QR preview unavailable',125,118);ctx.font='12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';ctx.fillText('Link still works normally',125,140);
  }
}

function persistCart(){localStorage.setItem('yr.market.cart.v2',JSON.stringify(state.cart));}
function avatarLetters(){return state.account.name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'YR';}
function coverTheme(b){return b.cover||({
  'taul-1':'linear-gradient(145deg,#ee6f2d,#f6a33e 52%,#f7c06a)',
  'taul-2':'linear-gradient(145deg,#1a1a1e,#413957 58%,#8f79b8)',
  'demo-3':'linear-gradient(145deg,#185f67,#4ea9a0 55%,#b6ddca)'
}[b.id]||'linear-gradient(145deg,#26262a,#6e5aff)');}
function cover(b,small=false){return `<div class="cover ${small?'small':''}" style="background:${coverTheme(b)}"><div class="coverTop">${b.series?esc(b.series):'YASREADY BOOKS'}</div><h3>${esc(b.title)}</h3><p>${esc(b.subtitle||b.author)}</p><span class="coverAuthor">${esc(b.author)}</span></div>`}

function shell(){
  const nav=[['store','Marketplace'],['dashboard','Home'],['books','My Books'],['sales','Sales'],['commerce','Commerce'],['fulfillment','Fulfillment'],['marketing','Promote'],['integrations','Connections']];
  return `<div class="topChrome">
    <div class="navWrap"><div class="shell nav">
      <button class="brand" data-nav="store">${brandMark}<span class="brandName">Marketplace <span class="brandDot">|</span> YasReady<small>Books made sellable.</small></span></button>
      <div class="navlinks">${nav.map(([id,label])=>`<button data-nav="${id}" class="${state.view===id?'active':''}">${label}</button>`).join('')}</div>
      <div class="navright"><button class="cartButton" data-cart>Bag <span class="cartCount ${state.cart.length?'':'hidden'}">${state.cart.length}</span></button><button class="avatar" data-nav="dashboard" title="Same YasReady account">${avatarLetters()}</button></div>
    </div></div>
    <div class="modeStrip"><div class="shell"><span><strong>v0.4.0 · Ingram Bridge</strong> <i></i> ${state.api?'D1/API connected':'demo data'} <i></i> same YasReady account</span><span class="safePill">LIVE MONEY OFF</span></div></div>
  </div>`;
}

function pageHead(kicker,title,copy,actions=''){
  return `<div class="pageHead shell"><div><span class="kicker">${kicker}</span><h1>${title}</h1><p>${copy}</p></div>${actions?`<div class="pageActions">${actions}</div>`:''}</div>`;
}

function bookCard(b){
  const live=liveEditions(b);
  return `<article class="bookCard" data-card-book="${b.id}">${cover(b)}<div class="bookMeta"><div class="eyebrow">${esc((b.categories||[])[0]||b.category||'Independent book')}</div><h3>${esc(b.title)}</h3><p>${esc(b.author)}${b.seriesNumber?` · Book ${b.seriesNumber}`:''}</p><div class="rating">★ ${b.rating||'New'} ${b.reviews?`· ${b.reviews} reviews`:''}</div><div class="editionChips">${b.editions.map(e=>`<span class="editionChip ${e.status==='live'?'live':''}">${esc(formatLabel(e.format))}${e.status!=='live'?` · ${esc(e.status)}`:''}</span>`).join('')}</div><div class="cardBottom"><div class="from"><span>From</span><strong>${live.length?money(minPrice(b)):'Coming soon'}</strong></div><button class="btn secondary small" data-book="${b.id}">View book</button></div></div></article>`;
}

function storeView(){
  const filtered=state.books.filter(b=>{
    const q=state.query.toLowerCase();
    const matches=!q||`${b.title} ${b.author} ${(b.categories||[]).join(' ')} ${b.category||''}`.toLowerCase().includes(q);
    const fmt=state.filter==='All'||b.editions.some(e=>formatLabel(e.format)===state.filter&&e.status==='live');
    return matches&&fmt;
  });
  return `<main class="view storeView">
    <section class="hero"><div class="shell heroGrid"><div class="heroCopy"><span class="kicker dark">Marketplace | YasReady</span><h1>Independent books.<br><span>Finished all the way.</span></h1><p>Discover books directly from independent authors — paperback, hardcover, ebook and audiobook together in one clean listing.</p><div class="heroActions"><button class="btn light" data-scroll="browse">Browse the marketplace</button><button class="btn ghostLight" data-nav="dashboard">I’m an author</button></div><div class="heroProof"><span>One book page</span><span>Every format</span><span>Direct author support</span></div></div><div class="heroStack">${state.books.slice(0,3).map((b,i)=>`<div class="stackBook s${i}">${cover(b,true)}</div>`).join('')}<div class="stackNote"><strong>Made in YasReady.</strong><span>Sold in YasReady.</span></div></div></div></section>
    <section class="section" id="browse"><div class="shell"><div class="sectionHead"><div><span class="kicker">Shop books</span><h2>One title. Every format.</h2></div><p>The storefront stays simple for readers while the author gets the commerce, attribution and fulfillment machinery underneath.</p></div>
    <div class="searchRow"><div class="searchBox"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input id="search" placeholder="Search title, author or category" value="${esc(state.query)}"></div><div class="filters">${['All','Ebook','Paperback','Hardcover','Audiobook'].map(f=>`<button class="filterBtn ${state.filter===f?'active':''}" data-filter="${f}">${f}</button>`).join('')}</div></div>
    <div class="bookGrid">${filtered.map(bookCard).join('')||'<div class="emptyState">No books match that search.</div>'}</div></div></section>
    <section class="section creatorPitch"><div class="shell pitchCard"><div><span class="kicker lime">For YasReady authors</span><h2>Your files aren’t the finish line.</h2><p>When your book is ready, Marketplace turns it into something people can actually buy — then gives you the links, QR codes, embeds, sales data and campaign attribution to promote it everywhere.</p></div><div class="pitchFlow"><div><strong>1</strong><span>Publish</span></div><i>→</i><div><strong>2</strong><span>Sell</span></div><i>→</i><div><strong>3</strong><span>Promote</span></div><i>→</i><div><strong>4</strong><span>Understand</span></div></div><button class="btn light" data-nav="dashboard">See the author side</button></div></section>
  </main>`;
}

function metric(label,value,detail,accent=''){return `<div class="metricCard ${accent}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`}
function sharedAccountCard(){return `<div class="accountBanner"><div class="accountIcon">${avatarLetters()}</div><div><span class="microLabel">YASREADY ACCOUNT</span><h3>${esc(state.account.name)}</h3><p>Publishing and Marketplace use the same identity. No second author login, password or profile to maintain.</p></div><div class="accountStatus"><span class="statusDot"></span> Connected</div></div>`}

function dashboardView(){
  const mine=myBooks(), d=state.dashboard;
  const liveCount=mine.reduce((s,b)=>s+liveEditions(b).length,0);
  return `<main class="view creatorView">${pageHead('Author home','Everything after “your book is ready.”','Your Marketplace workspace is attached to the same YasReady account you used to create the book.',`<button class="btn secondary" data-nav="store">View storefront</button><button class="btn primary" data-nav="marketing">Promote a book</button>`)}
  <div class="shell">${sharedAccountCard()}
    <div class="metricsGrid">${metric('Gross sales',money(d.grossSales),d.period,'purple')}${metric('Author earnings',money(d.authorEarnings),'Estimated net earnings','limeCard')}${metric('Books sold',d.units,`${d.orders} orders`)}${metric('Conversion',`${d.conversionRate}%`,`${d.views.toLocaleString()} listing visits`)}</div>
    <div class="twoCol dashboardMain"><section class="panel salesPanel"><div class="panelHead"><div><span class="microLabel">SALES</span><h2>Marketplace activity</h2></div><button class="textButton" data-nav="sales">Full sales view →</button></div>${sparkline(d.daily)}<div class="salesFooter"><div><strong>${money(d.grossSales)}</strong><span>gross in ${d.period.toLowerCase()}</span></div><div><strong>${d.repeatCustomerRate}%</strong><span>repeat customers</span></div><div><strong>${money(d.avgOrderValue)}</strong><span>average order</span></div></div></section>
    <section class="panel nextPanel"><div class="panelHead"><div><span class="microLabel">YOUR CATALOG</span><h2>${mine.length} books · ${liveCount} live editions</h2></div></div>${mine.map(b=>`<button class="miniBookRow" data-nav="books"><div class="tinyCover" style="background:${coverTheme(b)}"></div><div><strong>${esc(b.title)}</strong><span>${liveEditions(b).map(e=>formatLabel(e.format)).join(' · ')}</span></div><span class="liveBadge">Live</span></button>`).join('')}<button class="softAction" data-nav="books">Manage books</button></section></div>
    <section class="panel flowPanel"><div class="panelHead"><div><span class="microLabel">THE YASREADY LOOP</span><h2>One account. Three jobs.</h2></div></div><div class="systemFlow"><div><span class="systemIcon">P</span><strong>Publishing | YasReady</strong><p>Makes the book and owns production.</p></div><i>→</i><div class="activeSystem"><span class="systemIcon">M</span><strong>Marketplace | YasReady</strong><p>Sells it, markets it and captures commercial truth.</p></div><i>→</i><div><span class="systemIcon">B</span><strong>Business | YasReady</strong><p>Will understand the whole company using these clean numbers.</p></div></div></section>
  </div></main>`;
}

function sparkline(data){const m=max(data);return `<div class="spark"><div class="sparkGrid"><i></i><i></i><i></i><i></i></div><div class="bars">${data.map((v,i)=>`<span style="height:${Math.max(8,(v/m)*100)}%" title="${v}" class="${i===data.length-1?'last':''}"></span>`).join('')}</div></div>`}

function booksView(){
  const mine=myBooks();
  return `<main class="view creatorView">${pageHead('My Books','Your catalog follows your YasReady account.','Books imported from Publishing stay attached to the account that created them. Marketplace owns the listing and sales layer — not the production files.',`<a class="btn secondary" href="https://publishing.yasready.com" target="_blank" rel="noreferrer">Open Publishing ↗</a>`)}
  <div class="shell"><div class="noticeBar"><div class="noticeIcon">↔</div><div><strong>Shared-account contract is built into v0.3.0.</strong><span>`+'`authors.user_id`'+` maps to the same central YasReady identity. Marketplace never creates a second password.</span></div></div>
  <div class="manageBooks">${mine.map(manageBookCard).join('')}</div>
  <div class="importFuture"><span class="kicker">Later — not connected yet</span><h3>Publishing → Marketplace handshake</h3><p>The receiving schema is already reserved, but the switch stays off until Marketplace is independently proven. When we connect it, Publishing only sends a versioned completed-book package. Marketplace never reaches back into the Publishing codebase.</p><div class="payloadChips"><span>Title + metadata</span><span>Cover</span><span>ISBNs</span><span>Editions</span><span>Pricing</span><span>YasReady user ID</span></div></div>
  </div></main>`;
}
function manageBookCard(b){return `<article class="manageBook"><div class="manageCover">${cover(b,true)}</div><div class="manageBody"><div class="manageTitle"><div><span class="liveBadge">${b.listingStatus==='live'?'For sale':'Draft'}</span><h2>${esc(b.title)}</h2><p>${esc(b.subtitle||'')}</p></div><div class="bookMenu">•••</div></div><div class="editionTable">${b.editions.map(e=>`<div class="editionRow"><div><span class="formatIcon">${formatLabel(e.format)[0]}</span><div><strong>${esc(formatLabel(e.format))}</strong><small>${e.isbn?`ISBN ${esc(e.isbn)}`:'No ISBN required'}</small></div></div><div><span class="editionState ${e.status==='live'?'live':''}">${esc(e.status)}</span><strong>${money(e.price)}</strong><small>${e.fulfillment==='ingram'?'Ingram-ready':'YasReady digital'}</small></div></div>`).join('')}</div><div class="manageActions"><button class="btn secondary small" data-book="${b.id}">View listing</button><button class="btn primary small" data-promote="${b.id}">Promote</button></div></div></article>`}

function salesView(){const d=state.dashboard;return `<main class="view creatorView">${pageHead('Sales intelligence','Know what sold — and what caused it.','Marketplace captures orders and marketing attribution together so authors are not stitching together screenshots from five different tools.',`<button class="btn secondary" data-export-business>Preview Business feed</button>`)}
<div class="shell"><div class="metricsGrid five">${metric('Gross sales',money(d.grossSales),d.period,'purple')}${metric('Author earnings',money(d.authorEarnings),'After modeled costs','limeCard')}${metric('Orders',d.orders,`${d.units} units`)}${metric('Avg. order',money(d.avgOrderValue),'Across all formats')}${metric('Refunds',d.refunds,'Tracked separately')}</div>
<div class="twoCol salesLayout"><section class="panel"><div class="panelHead"><div><span class="microLabel">FORMAT MIX</span><h2>What readers buy</h2></div></div><div class="formatMix">${d.formatMix.map(x=>`<div class="mixRow"><div><strong>${x.label}</strong><span>${money(x.amount)}</span></div><div class="mixTrack"><i style="width:${x.value}%"></i></div><b>${x.value}%</b></div>`).join('')}</div></section>
<section class="panel"><div class="panelHead"><div><span class="microLabel">ATTRIBUTION</span><h2>What actually sells books</h2></div></div><div class="sourceTable"><div class="sourceHead"><span>Source</span><span>Visits</span><span>Orders</span><span>Revenue</span><span>Conv.</span></div>${d.sources.map(x=>`<div class="sourceRow"><strong>${x.source}</strong><span>${x.visits.toLocaleString()}</span><span>${x.sales}</span><span>${money(x.revenue)}</span><span>${x.conversion}%</span></div>`).join('')}</div></section></div>
<section class="panel ordersPanel"><div class="panelHead"><div><span class="microLabel">RECENT ORDERS</span><h2>Money and fulfillment stay separate</h2></div><span class="subtle">Payment state ≠ print state</span></div><div class="ordersTable"><div class="ordersHead"><span>Order</span><span>Book</span><span>Format</span><span>Gross</span><span>Your earnings</span><span>Status</span></div>${d.recentOrders.map(o=>`<div class="orderRow"><span><strong>${o.id}</strong><small>${o.when}</small></span><span>${esc(o.title)}</span><span>${o.format}</span><span>${money(o.gross)}</span><span>${money(o.earnings)}</span><span><i class="orderDot"></i>${o.status}</span></div>`).join('')}</div></section><section class="channelLane"><div><span class="microLabel">EXTERNAL SALES LANE</span><h3>Ingram network stats have their own pipe.</h3><p>External retailer/distribution reports land separately by provider, channel, ISBN, date and provenance. They can be shown alongside direct YasReady sales without quietly double-counting the same order.</p></div><div class="channelState"><span>Ingram</span><strong>Report adapter ready</strong><small>Import disabled until feed format + credentials are approved.</small></div></section></div></main>`}

function commerceView(){
  const d=state.dashboard;
  const gross=d.grossSales||248641, earned=d.authorEarnings||189420;
  return `<main class="view creatorView">${pageHead('Commerce','Every dollar has a paper trail.','v0.4 keeps the Commerce Closure ledger intact while adding a normalized fulfillment and provider-document layer around it.',`<button class="btn secondary" data-nav="sales">Sales intelligence</button><button class="btn primary" data-nav="integrations">Provider status</button>`)}
  <div class="shell"><div class="metricsGrid five">${metric('Captured',money(gross),'Paid Marketplace orders','purple')}${metric('Author earned',money(earned),'Ledger-backed earnings','limeCard')}${metric('Available',money(Math.max(0,earned-52340)),'Before next transfer')}${metric('Transferred',money(52340),'Demo payout ledger')}${metric('Refund reserve',money(1800),'Tracked separately')}</div>
  <div class="twoCol dashboardMain"><section class="panel"><div class="panelHead"><div><span class="microLabel">ORDER LIFECYCLE</span><h2>Nothing gets overwritten</h2></div></div><div class="flowList"><div><strong>1 · Checkout</strong><span>Server validates edition, seller, current price and inventory.</span></div><div><strong>2 · Payment</strong><span>Stripe webhook materializes the paid order exactly once.</span></div><div><strong>3 · Earnings</strong><span>Gross sale, marketplace fee, print reserve and seller payable become ledger entries.</span></div><div><strong>4 · Fulfillment</strong><span>Physical editions queue provider jobs; digital editions can grant entitlements.</span></div><div><strong>5 · Refund / transfer</strong><span>Reversals and payouts are separate records — history never gets rewritten.</span></div></div></section>
  <section class="panel"><div class="panelHead"><div><span class="microLabel">COMMERCE SAFETY</span><h2>Ready to test. Live money locked.</h2></div></div><div class="integrationMini"><strong>Stripe Checkout</strong><span>Test-mode architecture ready</span></div><div class="integrationMini"><strong>Connect sellers</strong><span>Same YasReady author account</span></div><div class="integrationMini"><strong>Refund allocation</strong><span>Pro-rated to the correct book + author</span></div><div class="integrationMini"><strong>Seller transfers</strong><span>Available balance cannot be exceeded</span></div><div class="integrationMini"><strong>Ingram fulfillment</strong><span>Paid physical items enter a queue</span></div><div class="noticeBar"><div class="noticeIcon">$</div><div><strong>Live money remains fail-closed.</strong><span>v0.3 ships with checkout, payouts and refunds disabled until credentials and policies are intentionally enabled.</span></div></div></section></div></div></main>`;
}


function fulfillmentView(){
  const jobs=[
    {order:'YR-1048',book:'Fault Lines',format:'Paperback',stage:'Ready to submit',detail:'PO envelope prepared · live transport off',tone:'ready'},
    {order:'YR-1046',book:'Tres Amigos, Una Vida',format:'Paperback',stage:'Acknowledged',detail:'PO → POA normalized',tone:'connected'},
    {order:'YR-1044',book:'Fault Lines',format:'Paperback',stage:'Shipped',detail:'ASN + tracking captured',tone:'connected'},
    {order:'YR-1039',book:'Tres Amigos, Una Vida',format:'Hardcover',stage:'Invoice matched',detail:'Actual fulfillment cost reconciled',tone:'connected'},
    {order:'YR-1031',book:'Fault Lines',format:'Hardcover',stage:'Needs attention',detail:'Provider exception held for review',tone:'future'}
  ];
  return `<main class="view creatorView">${pageHead('Fulfillment','Ingram truth without pretending we have an API we don’t.','v0.4 models the public Ingram retailer lifecycle — metadata, stock, purchase order, acknowledgment, pick/pack, shipment notice and invoice — behind explicit provider gates.',`<button class="btn secondary" data-nav="commerce">Commerce</button><button class="btn primary" data-nav="integrations">Connection status</button>`)}
  <div class="shell"><div class="metricsGrid five">${metric('Queued','3','Physical items awaiting provider action','purple')}${metric('Acknowledged','12','Provider accepted','limeCard')}${metric('Shipped','18','Tracking captured')}${metric('Exceptions','1','Held from auto-retry')}${metric('Last sync','Demo','Provider transport remains off')}</div>
  <section class="panel"><div class="panelHead"><div><span class="microLabel">INGRAM BRIDGE</span><h2>One normalized fulfillment lifecycle.</h2></div><span class="safePill">SUBMISSION OFF</span></div>
  <div class="systemFlow"><div><span class="systemIcon">M</span><strong>Metadata</strong><p>Title, author, ISBN and cover snapshots.</p></div><i>→</i><div><span class="systemIcon">S</span><strong>Stock</strong><p>Availability and provider-cost snapshots.</p></div><i>→</i><div class="activeSystem"><span class="systemIcon">PO</span><strong>Fulfillment</strong><p>PO → POA → Pick/Pack → ASN → Invoice.</p></div></div></section>
  <div class="twoCol dashboardMain"><section class="panel"><div class="panelHead"><div><span class="microLabel">FULFILLMENT QUEUE</span><h2>Every physical item gets its own job.</h2></div></div><div class="flowList">${jobs.map(j=>`<div><strong>${j.order} · ${esc(j.book)}</strong><span>${j.format} · ${j.stage}<br>${j.detail}</span></div>`).join('')}</div></section>
  <section class="panel"><div class="panelHead"><div><span class="microLabel">FAIL-SAFE OPERATIONS</span><h2>Automation cannot hide failure.</h2></div></div><div class="integrationMini"><strong>Idempotent provider documents</strong><span>Duplicate POA/ASN/invoice events do not duplicate state.</span></div><div class="integrationMini"><strong>Retry ledger</strong><span>Attempts, backoff and last error stay inspectable.</span></div><div class="integrationMini"><strong>Dead-letter queue</strong><span>Unmatched or malformed provider records wait for human review.</span></div><div class="integrationMini"><strong>Cost reconciliation</strong><span>Provider invoices update actual fulfillment cost without rewriting checkout history.</span></div></section></div>
  <section class="panel dataContract"><div><div class="microLabel">WHAT WE CAN CONNECT WHEN INGRAM APPROVES IT</div><h2>The transport is replaceable; Marketplace stays the same.</h2><p>v0.4 prepares normalized envelopes and consumes normalized provider documents. Whether Ingram gives YasReady EDI, a partner feed, Express Checkout eligibility or another approved transport, the storefront and commerce ledger do not need a rewrite.</p></div><pre>{
  "provider": "ingram",
  "outbound": ["purchase_order"],
  "inbound": ["purchase_order_ack", "asn", "invoice", "exception"],
  "feeds": ["metadata", "inventory", "sales"],
  "liveSubmission": false
}</pre></section></div></main>`;
}

function marketingView(){
  const b=state.books.find(x=>x.id===state.marketingBookId)||myBooks()[0];
  return `<main class="view creatorView">${pageHead('Promote','We sold the book. Now help people find it.','Every free marketing asset points back to the YasReady listing so clicks, campaigns and eventual sales can be attributed instead of disappearing into the internet.',`<button class="btn secondary" data-nav="sales">See attribution</button>`)}
  <div class="shell"><div class="promoteBookSelect"><label>Book</label><div class="selectWrap"><select id="marketingBook">${myBooks().map(x=>`<option value="${x.id}" ${x.id===b.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></div><span class="liveBadge">Live</span></div>
  <div class="marketingGrid"><section class="panel campaignBuilder"><div class="panelHead"><div><span class="microLabel">TRACKABLE LINKS</span><h2>Make a campaign</h2></div><span class="freeTag">FREE</span></div><div class="formGrid"><label>Campaign name<input id="campaignName" value="${esc(state.campaignName)}"></label><label>Where are you sharing it?<select id="campaignSource"><option value="instagram" ${state.campaignSource==='instagram'?'selected':''}>Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="email">Email / newsletter</option><option value="event-qr">Event / printed QR</option><option value="author-site">Author website</option><option value="other">Other</option></select></label></div><label class="fieldLabel">Your trackable YasReady link</label><div class="copyField"><input id="campaignLink" readonly><button data-copy="#campaignLink">Copy</button></div><p class="helper">Every visit keeps the campaign ID + UTM source. When checkout is live, the order keeps that campaign too.</p><button class="btn primary" id="saveCampaign">Save campaign</button></section>
  <section class="panel qrPanel"><div class="panelHead"><div><span class="microLabel">QR CODE</span><h2>Put the book anywhere.</h2></div><span class="freeTag">FREE</span></div><div class="qrFrame"><canvas id="qr"></canvas></div><p>Perfect for events, bookmarks, postcards, table signs, packaging and signed-book inserts.</p><button class="btn secondary" id="downloadQr">Download PNG</button></section></div>
  <div class="marketingGrid second"><section class="panel"><div class="panelHead"><div><span class="microLabel">WEBSITE EMBED</span><h2>Copy. Paste. Done.</h2></div><span class="freeTag">FREE</span></div><div class="embedPreview"><div class="tinyCover" style="background:${coverTheme(b)}"></div><div><strong>${esc(b.title)}</strong><span>${esc(b.author)}</span><button>See formats</button></div></div><pre id="embedCode">${esc(embedCode(b))}</pre><button class="btn secondary" data-copy-text="${encodeURIComponent(embedCode(b))}">Copy HTML</button></section>
  <section class="panel copyPanel"><div class="panelHead"><div><span class="microLabel">READY-TO-POST COPY</span><h2>Don’t start from a blank box.</h2></div><span class="freeTag">FREE</span></div><div class="copyOption"><span>Launch</span><p id="socialLaunch">${esc(`${b.title} by ${b.author} is available now. Choose your format and order here: ${campaignUrl(b,state.campaignName,state.campaignSource,state.campaignMedium)}`)}</p><button data-copy="#socialLaunch">Copy</button></div><div class="copyOption"><span>Short</span><p id="socialShort">${esc(`Read ${b.title}: ${campaignUrl(b,state.campaignName,state.campaignSource,state.campaignMedium)}`)}</p><button data-copy="#socialShort">Copy</button></div></section></div>
  <section class="panel campaignList"><div class="panelHead"><div><span class="microLabel">CAMPAIGNS</span><h2>Promotion that leaves receipts.</h2></div><span class="subtle">Demo performance</span></div><div class="campaignTable"><div class="campaignHead"><span>Campaign</span><span>Source</span><span>Clicks</span><span>Orders</span><span>Revenue</span></div>${state.campaigns.map(c=>`<div class="campaignRow"><strong>${esc(c.name)}</strong><span>${esc(c.source)}</span><span>${c.clicks}</span><span>${c.orders}</span><span>${money(c.revenue)}</span></div>`).join('')}</div></section>
  <div class="freeToolkit"><span class="kicker">The free author toolkit</span><h2>Give them reasons to keep coming back.</h2><div class="toolGrid">${['Permanent book URL','Campaign links','QR codes','HTML book cards','Buy buttons','Social copy','Email launch copy','Source attribution','Format sales data','Event links','Author storefront','Business-ready export'].map(x=>`<div><span>✓</span>${x}</div>`).join('')}</div></div>
  </div></main>`;
}

function embedCode(b){const url=`https://marketplace.yasready.com/book/${b.slug}`;return `<a href="${url}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#1d1d1f;color:#fff;text-decoration:none;font:700 15px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">Buy ${b.title} on YasReady</a>`}

function integrationsView(){return `<main class="view creatorView">${pageHead('Connections','The plugs are built before we need them.','v0.4.0 keeps identity, payments, fulfillment and Business analytics separate while adding a contract-safe Ingram bridge.')}
<div class="shell"><div class="integrationGrid">${integrationCard('Y','YasReady Account','Connected','The same central account used in Publishing becomes the Marketplace author identity. No second signup.','Shared identity','connected')}${integrationCard('S','Stripe Connect','Ready for test credentials','Express onboarding hooks, Checkout Sessions, webhooks, multi-seller allocation and reconciliation boundaries are in the Worker.','Payments + payouts','ready')}${integrationCard('I','Ingram','Partner-ready boundary','Share & Sell fallback plus metadata, stock, Consumer Direct Fulfillment and EDI lifecycle seams. Live fulfillment waits for an approved Ingram relationship.','Print fulfillment','ready')}${integrationCard('B','Business | YasReady','Export contract built','A normalized commercial feed already exposes gross sales, fees, fulfillment costs, author payable, formats and campaign performance.','Business intelligence','future')}</div>
<section class="panel architecturePanel"><div class="panelHead"><div><span class="microLabel">PRODUCTION SAFETY</span><h2>Things that stay off until they’re real.</h2></div></div><div class="safetyGrid"><div><span class="offPill">OFF</span><strong>Live checkout</strong><p>`+'`CHECKOUT_ENABLED=false`'+` is the tracked default.</p></div><div><span class="offPill">OFF</span><strong>Stripe live mode</strong><p>Requires secret + webhook configuration.</p></div><div><span class="offPill">OFF</span><strong>Ingram order submission</strong><p>No undocumented API calls or fake credentials.</p></div><div><span class="offPill">OFF</span><strong>Publishing import</strong><p>Receiving table exists; handshake remains disabled.</p></div></div></section>
<section class="panel dataContract"><div><div class="microLabel">BUSINESS HANDOFF</div><h2>Marketplace already knows the numbers Business will need.</h2><p>When Business is ready, it consumes a versioned Marketplace export instead of learning Marketplace’s internal database.</p></div><pre>{
  "schema": "yasready.marketplace.business.v1",
  "totals": {
    "grossSalesMinor": 248641,
    "marketplaceFeesMinor": 12432,
    "fulfillmentCostMinor": 51740,
    "sellerPayableMinor": 162174
  },
  "formats": [ ... ],
  "campaigns": [ ... ]
}</pre></section></div></main>`}
function integrationCard(letter,title,status,copy,foot,mode){return `<article class="integrationCard"><div class="integrationTop"><span class="integrationLogo ${mode}">${letter}</span><span class="integrationStatus ${mode}">${status}</span></div><h2>${title}</h2><p>${copy}</p><div class="integrationFoot">${foot}</div></article>`}

function bookModal(b){
  const live=liveEditions(b);
  return `<div class="modalShade" data-close-book><div class="bookModal" onclick="event.stopPropagation()"><button class="modalClose" data-close-book>×</button><div class="modalCover">${cover(b)}</div><div class="modalBody"><span class="kicker">${esc((b.categories||[])[0]||b.category||'Independent book')}</span><h1>${esc(b.title)}</h1><h3>${esc(b.subtitle||'')}</h3><p class="byline">by <strong>${esc(b.author)}</strong></p><p class="modalDesc">${esc(b.longDescription||b.description)}</p><div class="modalRating">★ ${b.rating||'New'} ${b.reviews?`· ${b.reviews} reader reviews`:''}</div><div class="buyFormats"><h4>Choose your format</h4>${b.editions.map(e=>`<div class="buyRow ${e.status!=='live'?'disabled':''}"><div><strong>${esc(formatLabel(e.format))}</strong><span>${e.isbn?`ISBN ${esc(e.isbn)}`:(formatLabel(e.format)==='Audiobook'?'Digital audio':'Digital edition')}</span></div><div><strong>${money(e.price)}</strong>${e.status==='live'?`<button class="btn primary small" data-add="${b.id}|${e.id}">Add</button>`:`<span class="editionState">${esc(e.status)}</span>`}</div></div>`).join('')}</div><div class="modalNote">Physical formats are modeled for Ingram fulfillment. Digital entitlements are already reserved in the database for ebooks and audiobooks.</div></div></div></div>`;
}

function cartDrawer(){
  const total=state.cart.reduce((a,x)=>a+x.price,0),sellers=new Set(state.cart.map(x=>x.authorId)).size;
  return `<div class="drawerShade" data-close-cart><aside class="cartDrawer" onclick="event.stopPropagation()"><div class="drawerHead"><div><span class="microLabel">YOUR BAG</span><h2>${state.cart.length} ${state.cart.length===1?'item':'items'}</h2></div><button data-close-cart>×</button></div>${state.cart.length?`<div class="cartItems">${state.cart.map((x,i)=>`<div class="cartItem"><div><strong>${esc(x.title)}</strong><span>${esc(x.author)} · ${esc(x.format)}</span></div><div><strong>${money(x.price)}</strong><button data-remove="${i}">Remove</button></div></div>`).join('')}</div><div class="cartSummary"><div><span>Subtotal</span><strong>${money(total)}</strong></div><div><span>Independent authors</span><strong>${sellers}</strong></div></div><button class="btn primary wide" data-demo-checkout>Continue to checkout</button><p class="cartFine">v0.4 validates edition price and seller server-side before Stripe. Stripe test checkout is wired behind server-side safety gates; live money remains intentionally disabled in this package.</p>`:`<div class="emptyCart"><strong>Your bag is empty.</strong><p>Add an edition from any Marketplace listing.</p></div>`}</aside></div>`;
}

function render(){
  const views={store:storeView,dashboard:dashboardView,books:booksView,sales:salesView,commerce:commerceView,fulfillment:fulfillmentView,marketing:marketingView,integrations:integrationsView};
  app.innerHTML=shell()+(views[state.view]||storeView)()+`<footer><div class="shell"><div>${brandMark}<strong>Marketplace <span>|</span> YasReady</strong></div><p>Make it. Sell it. Understand it.</p><span>v0.4.0 · Ingram Bridge</span></div></footer>`+(state.selected?bookModal(state.selected):'');
  bind();if(state.view==='marketing')setupMarketing();
}

function toast(msg){const x=document.createElement('div');x.className='toast';x.textContent=msg;document.body.append(x);setTimeout(()=>x.remove(),2600)}
function navigate(view){state.view=view;state.selected=null;history.replaceState({},'',location.pathname+location.search);track('navigation',{view});render();scrollTo({top:0,behavior:'smooth'})}

function bind(){
  document.querySelectorAll('[data-nav]').forEach(x=>x.onclick=()=>navigate(x.dataset.nav));
  document.querySelector('[data-cart]')?.addEventListener('click',()=>{document.body.insertAdjacentHTML('beforeend',cartDrawer());bindCart();track('cart_opened')});
  document.querySelectorAll('[data-book]').forEach(x=>x.onclick=()=>{state.selected=state.books.find(b=>b.id===x.dataset.book);track('book_viewed',{bookId:state.selected?.id});render()});
  document.querySelectorAll('[data-promote]').forEach(x=>x.onclick=()=>{state.marketingBookId=x.dataset.promote;navigate('marketing')});
  document.querySelectorAll('[data-close-book]').forEach(x=>x.onclick=()=>{state.selected=null;render()});
  document.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>{
    const [bid,eid]=x.dataset.add.split('|'),b=state.books.find(z=>z.id===bid),e=b.editions.find(z=>z.id===eid);state.cart.push({bookId:b.id,editionId:e.id,title:b.title,author:b.author,authorId:b.authorId,format:formatLabel(e.format),price:e.price,priceMinor:e.priceMinor||Math.round(e.price*100),fulfillment:e.fulfillment});persistCart();track('cart_item_added',{bookId:b.id,editionId:e.id,format:e.format,price:e.price,authorId:b.authorId});toast(`${formatLabel(e.format)} added to bag`);render();
  });
  document.querySelectorAll('[data-filter]').forEach(x=>x.onclick=()=>{state.filter=x.dataset.filter;track('catalog_filtered',{filter:state.filter});render();setTimeout(()=>document.querySelector('#browse')?.scrollIntoView(),0)});
  const s=document.querySelector('#search');if(s)s.oninput=e=>{state.query=e.target.value;clearTimeout(window.__q);window.__q=setTimeout(()=>{track('catalog_searched',{query:state.query});render();document.querySelector('#search')?.focus()},160)};
  document.querySelectorAll('[data-scroll]').forEach(x=>x.onclick=()=>document.querySelector('#'+x.dataset.scroll)?.scrollIntoView({behavior:'smooth'}));
  document.querySelector('[data-export-business]')?.addEventListener('click',()=>{toast('Business export contract: yasready.marketplace.business.v1');track('business_export_previewed')});
}

function bindCart(){
  document.querySelectorAll('[data-close-cart]').forEach(x=>x.onclick=()=>document.querySelector('.drawerShade')?.remove());
  document.querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{state.cart.splice(Number(x.dataset.remove),1);persistCart();document.querySelector('.drawerShade')?.remove();render();document.body.insertAdjacentHTML('beforeend',cartDrawer());bindCart()});
  document.querySelector('[data-demo-checkout]')?.addEventListener('click',async()=>{
    const items=state.cart.map(x=>({editionId:x.editionId,quantity:1}));
    track('checkout_started',{items:items.length,sellerCount:new Set(state.cart.map(x=>x.authorId)).size});
    try{const r=await fetch('/api/checkout/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items})});const d=await r.json();if(!r.ok)throw new Error(d.message||d.error);toast(`Server checkout plan ready · ${d.allocationPlan?.length||0} author allocation${d.allocationPlan?.length===1?'':'s'}`)}catch{toast('Demo checkout plan ready · live money remains off')}
  });
}

async function setupMarketing(){
  const select=document.querySelector('#marketingBook');
  select.onchange=()=>{state.marketingBookId=select.value;render()};
  const name=document.querySelector('#campaignName'),source=document.querySelector('#campaignSource'),link=document.querySelector('#campaignLink'),canvas=document.querySelector('#qr');
  const b=state.books.find(x=>x.id===state.marketingBookId)||myBooks()[0];
  async function update(){state.campaignName=name.value||'campaign';state.campaignSource=source.value;const medium=['instagram','facebook','tiktok'].includes(source.value)?'social':source.value==='email'?'email':source.value==='event-qr'?'offline':'referral';state.campaignMedium=medium;const url=campaignUrl(b,state.campaignName,state.campaignSource,medium);link.value=url;await renderQr(canvas,url);const sl=document.querySelector('#socialLaunch'),ss=document.querySelector('#socialShort');if(sl)sl.textContent=`${b.title} by ${b.author} is available now. Choose your format and order here: ${url}`;if(ss)ss.textContent=`Read ${b.title}: ${url}`;track('marketing_asset_previewed',{type:'campaign_link',bookId:b.id,source:source.value})}
  name.oninput=update;source.onchange=update;await update();
  document.querySelectorAll('[data-copy]').forEach(x=>x.onclick=async()=>{const el=document.querySelector(x.dataset.copy),txt='value'in el?el.value:el.textContent;await navigator.clipboard.writeText(txt);track('marketing_asset_copied',{bookId:b.id});toast('Copied')});
  document.querySelectorAll('[data-copy-text]').forEach(x=>x.onclick=async()=>{await navigator.clipboard.writeText(decodeURIComponent(x.dataset.copyText));track('marketing_asset_copied',{type:'embed',bookId:b.id});toast('HTML copied')});
  document.querySelector('#downloadQr').onclick=()=>{const a=document.createElement('a');a.download=`${b.slug}-${state.campaignName.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-qr.png`;a.href=canvas.toDataURL('image/png');a.click();track('marketing_asset_downloaded',{type:'qr',bookId:b.id});};
  document.querySelector('#saveCampaign').onclick=async()=>{
    const payload={bookId:b.id,name:state.campaignName,source:state.campaignSource,medium:state.campaignMedium};
    try{const r=await authFetch('/api/me/campaigns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error();const d=await r.json();state.campaigns.unshift({id:d.campaign.id,bookId:b.id,name:state.campaignName,source:state.campaignSource,clicks:0,orders:0,revenue:0});toast('Campaign saved to Marketplace')}catch{state.campaigns.unshift({id:'local-'+Date.now(),bookId:b.id,name:state.campaignName,source:state.campaignSource,clicks:0,orders:0,revenue:0});toast('Campaign saved in demo mode')}track('campaign_created',{bookId:b.id,source:state.campaignSource});
  };
}

function adaptApiBook(b){
  return {id:b.id,slug:b.slug,title:b.title,subtitle:b.subtitle,author:b.author?.name||'YasReady Author',authorId:b.author?.id,handle:b.author?.handle,description:b.description,longDescription:b.longDescription,cover:b.coverUrl?`url(${b.coverUrl}) center/cover` : undefined,categories:[b.category].filter(Boolean),listingStatus:b.listing?.status||'live',editions:(b.editions||[]).map(e=>({id:e.id,format:formatLabel(e.format),price:(e.priceMinor||0)/100,priceMinor:e.priceMinor,isbn:e.isbn,status:e.status,fulfillment:e.fulfillmentProvider,inventoryStatus:e.inventoryStatus}))};
}

async function hydrateFromApi(){
  try{
    const [catalogRes,sessionRes]=await Promise.all([fetch('/api/catalog',{headers:{accept:'application/json'}}),authFetch('/api/session',{headers:{accept:'application/json'}})]);
    if(!catalogRes.ok||!sessionRes.ok) return;
    const catalog=await catalogRes.json(),session=await sessionRes.json();
    if(catalog.books?.length) state.books=catalog.books.map(adaptApiBook);
    if(session.author){state.account={userId:session.identity.userId,name:session.author.displayName,email:session.author.email,authorId:session.author.id,handle:session.author.handle,sharedAccount:true};}
    const mine=state.books.filter(b=>b.authorId===state.account.authorId);if(mine[0])state.marketingBookId=mine[0].id;
    state.api=true;render();
  }catch{}
}

const pathMatch=location.pathname.match(/(?:^|\/)book\/([^/]+)\/?$/);const q=new URLSearchParams(location.search);const slug=pathMatch?decodeURIComponent(pathMatch[1]):q.get('book');if(slug){const found=state.books.find(b=>b.slug===slug);if(found)state.selected=found;track('campaign_landing',{bookId:found?.id,bookSlug:slug,source:q.get('utm_source'),campaignId:q.get('yr_campaign')})}
render();hydrateFromApi();
