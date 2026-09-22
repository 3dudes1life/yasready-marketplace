import {account as demoAccount,books as demoBooks,dashboard as demoDashboard,campaigns as demoCampaigns} from './data/demo.js';
import {track,campaignUrl} from './lib/analytics.js';
import {authFetch} from './lib/session-client.js';

const app=document.querySelector('#app');
setTimeout(()=>setTheme(currentTheme()),0);
const state={
  view:'store',filter:'All',query:'',selected:null,
  cart:JSON.parse(localStorage.getItem('yr.market.cart.v2')||'[]'),
  account:{...demoAccount},books:[...demoBooks],dashboard:{...demoDashboard},campaigns:[...demoCampaigns],
  api:false,loading:false,catalogEditor:null,marketingBookId:'taul-2',campaignName:'Launch campaign',campaignSource:'instagram',campaignMedium:'social',
  publicAuthorHandle:null,publicSeries:null,
  reader:{saved:JSON.parse(localStorage.getItem('yr.market.saved.v1')||'["taul-2"]'),recent:JSON.parse(localStorage.getItem('yr.market.recent.v1')||'[]'),library:[{bookId:'taul-1',editionId:'taul1-ebook',format:'Ebook',percent:63},{bookId:'demo-3',editionId:'long-audio',format:'Audiobook',percent:34,secondsPosition:4280}]}
};

const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const moneyMinor=n=>money((Number(n)||0)/100);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const liveEditions=b=>b.editions.filter(e=>e.status==='live');
const minPrice=b=>Math.min(...liveEditions(b).map(e=>e.price));
const myBooks=()=>state.books.filter(b=>b.authorId===state.account.authorId);
const publicViews=new Set(['store','library','saved','authorpage','seriespage']);
const isPublicView=()=>publicViews.has(state.view);
const savedBooks=()=>state.books.filter(b=>state.reader.saved.includes(b.id));
const recentBooks=()=>state.reader.recent.map(id=>state.books.find(b=>b.id===id)).filter(Boolean);
function persistReader(){localStorage.setItem('yr.market.saved.v1',JSON.stringify(state.reader.saved.slice(0,100)));localStorage.setItem('yr.market.recent.v1',JSON.stringify(state.reader.recent.slice(0,20)))}
function recordRecent(bookId){state.reader.recent=[bookId,...state.reader.recent.filter(x=>x!==bookId)].slice(0,20);persistReader();if(state.api)authFetch(`/api/reader/recent/${encodeURIComponent(bookId)}`,{method:'POST'}).catch(()=>{})}

const max=(arr)=>Math.max(1,...arr.map(Number));
const formatLabel=f=>({ebook:'Ebook',paperback:'Paperback',hardcover:'Hardcover',audiobook:'Audiobook'}[String(f).toLowerCase()]||f);
const currentTheme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
function setTheme(theme){
  const next=theme==='dark'?'dark':'light';
  document.documentElement.dataset.theme=next;
  try{localStorage.setItem('yasready-theme',next)}catch{}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=next==='dark'?'#07090e':'#f4f5f8';
}
function themeGlyph(){return currentTheme()==='dark'?'☀':'☾'}

const brandMark=`<span class="brandMark"><img src="./yasready-mark.png" alt="" aria-hidden="true"></span>`;

const navIcon=id=>{
  const icons={
    store:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    books:'<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M8 4.5v15.5"/><path d="M18 7.5h1a2 2 0 0 1 2 2V20h-3"/>',
    launch:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 18v3h14v-3"/>',
    sales:'<path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/>',
    commerce:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    fulfillment:'<path d="M3 7.5 12 3l9 4.5-9 4.5z"/><path d="M3 7.5V17l9 4 9-4V7.5"/><path d="M12 12v9"/>',
    marketing:'<path d="m4 14 11-5v10L4 14z"/><path d="M15 11.5h3a3 3 0 0 1 0 6h-3"/><path d="m6 15 1.5 5h3L9 16"/>',
    integrations:'<path d="M8 12a4 4 0 1 1 4-4"/><path d="M16 12a4 4 0 1 1-4 4"/><path d="M10 12h4"/>'
  };
  return `<svg class="navIcon" viewBox="0 0 24 24" aria-hidden="true">${icons[id]||icons.dashboard}</svg>`;
};

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
  const all=[['dashboard','Home'],['books','My Books'],['launch','Launch'],['sales','Sales'],['marketing','Promote'],['commerce','Commerce'],['fulfillment','Fulfillment'],['integrations','Connections']];
  if(isPublicView()){
    return `<div class="publicChrome">
      <div class="shell publicNav">
        <button class="brand publicBrand" data-nav="store">${brandMark}<span class="brandName">Marketplace <span class="brandDot">|</span> YasReady<small>Independent books, finished all the way.</small></span></button>
        <div class="publicLinks"><button data-nav="store">Discover</button><button data-nav="library">Library</button><button data-nav="saved">Saved</button><button data-nav="dashboard">For authors</button></div>
        <div class="navright"><button class="readerNavIcon" data-nav="saved" aria-label="Saved books">♡ <span>${state.reader.saved.length}</span></button><button class="cartButton" data-cart>Bag <span class="cartCount ${state.cart.length?'':'hidden'}">${state.cart.length}</span></button><button class="yr-shared-theme-toggle" data-theme-toggle title="Switch appearance" aria-label="Switch light and dark appearance">${themeGlyph()}</button><button class="btn primary publicAuthorCta" data-nav="dashboard">Author workspace</button></div>
      </div>
    </div>`;
  }
  const label=all.find(([id])=>id===state.view)?.[1]||'Home';
  const groups=[
    ['Workspace',all.slice(0,4)],
    ['Grow',[all[4]]],
    ['Operations',all.slice(5)]
  ];
  return `<div class="creatorChrome">
    <aside class="yrSidebar" aria-label="Marketplace workspace navigation">
      <button class="brand sidebarBrand" data-nav="dashboard">${brandMark}<span class="brandName">Marketplace <span class="brandDot">|</span> YasReady<small>Author workspace</small></span></button>
      <div class="sidebarGroups">${groups.map(([name,items])=>`<section class="sidebarGroup"><span>${name}</span>${items.map(([id,text])=>`<button data-nav="${id}" aria-current="${state.view===id?'page':'false'}" class="${state.view===id?'active':''}">${navIcon(id)}<b>${text}</b>${id==='launch'?'<i class="readyMini">READY</i>':''}</button>`).join('')}</section>`).join('')}</div>
      <div class="sidebarBottom">
        <button class="storeReturn" data-nav="store">${navIcon('store')}<span><b>View storefront</b><small>marketplace.yasready.com</small></span></button>
        <div class="accountMini"><div class="avatar">${avatarLetters()}</div><span><b>${esc(state.account.name)}</b><small>Same YasReady account</small></span></div>
      </div>
    </aside>
    <header class="yrTopbar">
      <div class="topbarTitle"><span>Marketplace</span><i>/</i><strong>${label}</strong><span class="envPill">${state.api?'CONNECTED':'DEMO'}</span></div>
      <div class="topbarActions"><span class="moneyLock"><i></i> Live money off</span><button class="cartButton" data-cart>Bag <span class="cartCount ${state.cart.length?'':'hidden'}">${state.cart.length}</span></button><button class="yr-shared-theme-toggle" data-theme-toggle title="Switch appearance" aria-label="Switch light and dark appearance">${themeGlyph()}</button><button class="avatar topAvatar" data-nav="dashboard">${avatarLetters()}</button></div>
    </header>
    <nav class="yrMobileNav" aria-label="Mobile workspace navigation">${all.map(([id,text])=>`<button data-nav="${id}" class="${state.view===id?'active':''}">${navIcon(id)}<span>${text}</span></button>`).join('')}</nav>
  </div>`;
}

function pageHead(kicker,title,copy,actions=''){
  return `<div class="pageHead shell"><div><span class="kicker">${kicker}</span><h1>${title}</h1><p>${copy}</p></div>${actions?`<div class="pageActions">${actions}</div>`:''}</div>`;
}

function saveButton(b){const on=state.reader.saved.includes(b.id);return `<button class="saveBook ${on?'saved':''}" data-save="${b.id}" aria-label="${on?'Remove from saved':'Save book'}">${on?'♥':'♡'}</button>`}
function bookCard(b){
  const live=liveEditions(b),digital=live.filter(e=>['Ebook','Audiobook'].includes(formatLabel(e.format))).map(e=>formatLabel(e.format));
  return `<article class="bookCard consumerBookCard" data-card-book="${b.id}"><div class="bookCoverWrap">${cover(b)}${saveButton(b)}</div><div class="bookMeta"><div class="eyebrow">${esc((b.categories||[])[0]||b.category||'Independent book')}</div><h3>${esc(b.title)}</h3><button class="authorLink" data-author="${esc(b.handle||'')}">${esc(b.author)}</button>${b.series?`<button class="seriesLink" data-series="${encodeURIComponent(b.series)}">${esc(b.series)}${b.seriesNumber?` · Book ${b.seriesNumber}`:''}</button>`:''}<div class="rating">★ ${b.rating||'New'} ${b.reviews?`· ${b.reviews} reviews`:''}</div><div class="editionChips">${live.map(e=>`<span class="editionChip live">${esc(formatLabel(e.format))}</span>`).join('')}</div>${digital.length?`<small class="booksReady">Read/listen in YasReady. Books</small>`:''}<div class="cardBottom"><div class="from"><span>From</span><strong>${live.length?money(minPrice(b)):'Coming soon'}</strong></div><button class="btn secondary small" data-book="${b.id}">View book</button></div></div></article>`;
}

function shelf(title,copy,books,action=''){
  if(!books.length)return '';
  return `<section class="consumerShelf shell"><div class="shelfHead"><div><span class="kicker">${esc(title)}</span><h2>${esc(copy)}</h2></div>${action}</div><div class="shelfScroll">${books.map(bookCard).join('')}</div></section>`;
}
function storeView(){
  const q=state.query.toLowerCase(),filtered=state.books.filter(b=>{const matches=!q||`${b.title} ${b.author} ${(b.categories||[]).join(' ')} ${b.category||''} ${b.series||''}`.toLowerCase().includes(q);const fmt=state.filter==='All'||b.editions.some(e=>formatLabel(e.format)===state.filter&&e.status==='live');return matches&&fmt});
  const featured=state.books.filter(b=>b.featured).concat(state.books.filter(b=>!b.featured)).slice(0,3),recent=recentBooks().slice(0,5),audio=state.books.filter(b=>liveEditions(b).some(e=>formatLabel(e.format)==='Audiobook')),ebooks=state.books.filter(b=>liveEditions(b).some(e=>formatLabel(e.format)==='Ebook'));
  const categories=[...new Set(state.books.flatMap(b=>b.categories||[b.category]).filter(Boolean))];
  return `<main class="view storeView consumerStore">
    <section class="consumerHero"><div class="shell consumerHeroGrid"><div><span class="kicker dark">Marketplace | YasReady</span><h1>Find your next story.<br><span>Read it. Listen to it. Keep it.</span></h1><p>Independent books across ebook, audiobook and print — with digital purchases built for your future YasReady. Books library.</p><div class="heroSearch"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input id="heroSearch" placeholder="Search books, authors, series or genres" value="${esc(state.query)}"></div><div class="heroActions"><button class="btn light" data-scroll="browse">Browse all books</button><button class="btn ghostLight" data-nav="library">Open my library</button></div></div><div class="featuredBookStack">${featured.map((b,i)=>`<button data-book="${b.id}" class="featuredMini f${i}">${cover(b,true)}<span>${esc(b.title)}</span></button>`).join('')}</div></div></section>
    <section class="discoveryStrip"><div class="shell"><strong>Browse by genre</strong><div>${categories.map(c=>`<button data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div></div></section>
    ${recent.length?shelf('Pick up where you left off','Recently viewed',recent,'<button class="textButton" data-nav="saved">Saved books →</button>'):''}
    ${shelf('Digital first','Read it today',ebooks.slice(0,6))}
    ${audio.length?shelf('Press play','Audiobooks ready to listen',audio.slice(0,6)):''}
    <section class="section" id="browse"><div class="shell"><div class="sectionHead"><div><span class="kicker">Discover</span><h2>Independent books, every format.</h2></div><p>One title page keeps paperback, hardcover, ebook and audiobook together — without making readers hunt across four stores.</p></div><div class="searchRow"><div class="searchBox"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input id="search" placeholder="Search the marketplace" value="${esc(state.query)}"></div><div class="filters">${['All','Ebook','Paperback','Hardcover','Audiobook'].map(f=>`<button class="filterBtn ${state.filter===f?'active':''}" data-filter="${f}">${f}</button>`).join('')}</div></div><div class="bookGrid">${filtered.map(bookCard).join('')||'<div class="emptyState">No books match that search.</div>'}</div></div></section>
    <section class="booksAppBridge"><div class="shell"><div><span class="kicker lime">YasReady. Books</span><h2>Buy here. Read and listen anywhere.</h2><p>Marketplace is already storing digital ownership and progress as one reader library, so the future Books app can simply pick up where the website leaves off.</p></div><div class="appBridgeMock"><span>Y.</span><strong>My Library</strong><small>Ebooks · Audiobooks · Progress synced</small></div></div></section>
  </main>`;
}

function libraryView(){
  const items=state.reader.library.map(x=>({...x,book:state.books.find(b=>b.id===x.bookId)})).filter(x=>x.book);
  return `<main class="view readerPage"><div class="shell readerPageHead"><span class="kicker">Your library</span><h1>Read. Listen. Pick up where you left off.</h1><p>Digital books bought through Marketplace belong to this same YasReady account — ready for YasReady. Books later without another account or import.</p></div><div class="shell libraryGrid">${items.length?items.map(x=>`<article class="libraryItem">${cover(x.book,true)}<div><span class="formatPill">${esc(x.format)}</span><h2>${esc(x.book.title)}</h2><p>${esc(x.book.author)}</p><div class="progressTrack"><i style="width:${x.percent}%"></i></div><small>${Math.round(x.percent)}% complete</small><button class="btn primary" data-open-library="${x.bookId}|${x.editionId}|${x.format}">${x.format==='Audiobook'?'Continue listening':'Continue reading'}</button></div></article>`).join(''):`<div class="emptyReader"><h2>Your library is waiting.</h2><p>When you buy an ebook or audiobook, it will appear here automatically.</p><button class="btn primary" data-nav="store">Discover books</button></div>`}</div><div class="shell libraryPromise"><strong>Built for YasReady. Books</strong><span>Entitlements · progress · offline-ready architecture · one YasReady account</span></div></main>`;
}
function savedView(){const books=savedBooks();return `<main class="view readerPage"><div class="shell readerPageHead"><span class="kicker">Saved</span><h1>Books you don’t want to lose.</h1><p>Save a title while browsing and come back when you’re ready to choose a format.</p></div><div class="shell bookGrid">${books.length?books.map(bookCard).join(''):`<div class="emptyReader"><h2>Nothing saved yet.</h2><p>Tap the heart on any book to keep it here.</p><button class="btn primary" data-nav="store">Browse books</button></div>`}</div></main>`}
function authorPageView(){const books=state.books.filter(b=>b.handle===state.publicAuthorHandle);const b=books[0];if(!b)return `<main class="view readerPage"><div class="shell">${errorState('Author not found','That author storefront is not available.')}</div></main>`;return `<main class="view readerPage"><section class="authorHero"><div class="shell"><div class="authorAvatar">${esc(b.author.split(/\s+/).slice(0,2).map(x=>x[0]).join(''))}</div><div><span class="kicker">Author storefront</span><h1>${esc(b.author)}</h1><p>${esc(b.authorBio||b.authorTagline||(state.account.authorId===b.authorId&&state.account.bio?state.account.bio:'Independent author on Marketplace | YasReady.'))}</p><button class="btn secondary" data-follow="${b.authorId}">Follow author</button></div></div></section>${shelf('Books by this author',`${books.length} ${books.length===1?'title':'titles'} on YasReady`,books)}</main>`}
function seriesPageView(){const name=state.publicSeries;const books=state.books.filter(b=>b.series===name).sort((a,b)=>(a.seriesNumber||999)-(b.seriesNumber||999));if(!books.length)return `<main class="view readerPage"><div class="shell">${errorState('Series not found','That series is not available.')}</div></main>`;return `<main class="view readerPage"><div class="shell seriesHero"><span class="kicker">Series</span><h1>${esc(name)}</h1><p>Read the series in order, with every available format kept on the same title page.</p></div>${shelf('Reading order',`${books.length} books`,books)}</main>`}

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
  return `<main class="view creatorView">${pageHead('My Books','Your catalog is a working part of the business now.','Publishing supplies production truth. Here you control the storefront presentation, pricing, availability, SEO and author profile — with autosave, validation and preview before anything changes live.',`<a class="btn secondary" href="https://publishing.yasready.com" target="_blank" rel="noreferrer">Open Publishing ↗</a>`)}
  <div class="shell"><div class="noticeBar"><div class="noticeIcon">↔</div><div><strong>Production truth stays protected.</strong><span>Marketplace edits are stored as commercial presentation overrides. ISBNs, artifacts and production provenance still belong to Publishing.</span></div></div>
  <div class="catalogSummary"><div><span class="microLabel">CATALOG</span><strong>${mine.length}</strong><small>books</small></div><div><span class="microLabel">LIVE EDITIONS</span><strong>${mine.reduce((n,b)=>n+liveEditions(b).length,0)}</strong><small>for sale</small></div><div><span class="microLabel">DRAFTS</span><strong>${mine.filter(b=>b.listingStatus!=='live').length}</strong><small>not public</small></div><div><span class="microLabel">CONTROL</span><strong>Yours</strong><small>price + presentation</small></div></div>
  <div class="manageBooks">${mine.map(manageBookCard).join('')}</div>
  <div class="importFuture"><span class="kicker">How v0.8 works</span><h3>Edit without breaking production.</h3><p>Every book gets a Marketplace working draft. Changes autosave into that draft, validate against the production editions, and can be previewed before you apply them. Applying a draft records exactly what changed and increments the listing revision.</p><div class="payloadChips"><span>Autosave</span><span>Optimistic locking</span><span>Preview</span><span>Validation</span><span>Change history</span><span>Publishing-safe overrides</span></div></div>
  </div></main>`;
}
function manageBookCard(b){
  const ready=b.editions.filter(e=>e.status==='live').length;
  return `<article class="manageBook catalogBookCard"><div class="manageCover">${cover(b,true)}</div><div class="manageBody"><div class="manageTitle"><div><span class="liveBadge ${b.listingStatus==='live'?'':'draftBadge'}">${b.listingStatus==='live'?'For sale':'Draft'}</span><h2>${esc(b.title)}</h2><p>${esc(b.subtitle||'No subtitle')}</p></div><span class="catalogRevision">rev ${Number(b.listingRevision||0)}</span></div><div class="catalogBookFacts"><span><b>${b.editions.length}</b> formats</span><span><b>${ready}</b> live</span><span>${esc((b.categories||[])[0]||b.category||'Category not set')}</span></div><div class="editionTable">${b.editions.map(e=>`<div class="editionRow"><div><span class="formatIcon">${formatLabel(e.format)[0]}</span><div><strong>${esc(formatLabel(e.format))}</strong><small>${e.isbn?`ISBN ${esc(e.isbn)}`:'Digital edition'}</small></div></div><div><span class="editionState ${e.status==='live'?'live':''}">${esc(e.status)}</span><strong>${money(e.price)}</strong><small>${e.fulfillment==='ingram'?'Ingram-ready':'YasReady digital'}</small></div></div>`).join('')}</div><div class="manageActions"><button class="btn secondary small" data-book="${b.id}">View listing</button><button class="btn secondary small" data-promote="${b.id}">Promote</button><button class="btn primary small" data-edit-catalog="${b.id}">Edit listing</button></div></div></article>`
}

function localCatalogDraft(b){
  return {book:{displayTitle:b.title||'',displaySubtitle:b.subtitle||'',description:b.description||'',longDescription:b.longDescription||b.description||'',coverUrl:b.coverUrl||'',primaryCategory:(b.categories||[])[0]||b.category||'',excerpt:b.excerpt||''},listing:{visibility:b.visibility||'public',seoTitle:b.seoTitle||b.title||'',seoDescription:b.seoDescription||b.description||'',launchAt:b.launchAt||''},author:{displayName:state.account.name||b.author||'',bio:state.account.bio||'',websiteUrl:state.account.websiteUrl||'',storefrontTagline:state.account.storefrontTagline||''},editions:b.editions.map(e=>({id:e.id,priceMinor:e.priceMinor??Math.round((e.price||0)*100),status:e.status||'draft'}))};
}
function demoValidateDraft(d){const errors=[],warnings=[];if(!d.book.displayTitle)errors.push('title_required');if(!d.book.coverUrl&&!state.catalogEditor?.book?.cover)warnings.push('cover_uses_current_artwork');if(!d.author.displayName)errors.push('author_name_required');for(const e of d.editions){if(e.status==='live'&&e.priceMinor<=0)errors.push(`price_required:${e.id}`)}if(!d.book.description)warnings.push('description_recommended');return{valid:errors.length===0,errors,warnings,saleReadyEditionCount:d.editions.filter(e=>e.status==='live'&&e.priceMinor>0).length}}

async function openCatalogEditor(bookId){
  const b=state.books.find(x=>x.id===bookId);if(!b)return;
  let initialDraft=localCatalogDraft(b);if(!state.api){try{const saved=localStorage.getItem(`yr.market.catalog.${bookId}`);if(saved)initialDraft=JSON.parse(saved)}catch{}}
  state.catalogEditor={bookId,book:b,draft:initialDraft,draftRevision:0,listingRevision:Number(b.listingRevision||0),validation:null,saving:false,savedAt:null,history:[],loading:state.api};render();
  if(state.api){
    try{
      const [r,h]=await Promise.all([authFetch(`/api/me/books/${encodeURIComponent(bookId)}/editor`,{headers:{accept:'application/json'}}),authFetch(`/api/me/books/${encodeURIComponent(bookId)}/history`,{headers:{accept:'application/json'}})]),d=await r.json(),hd=await h.json();if(!r.ok)throw new Error(d.error||'editor_load_failed');
      state.catalogEditor={...state.catalogEditor,draft:d.draft,draftRevision:d.draftRevision,listingRevision:d.listingRevision,validation:d.validation,history:hd.history||[],loading:false};render();
    }catch(err){state.catalogEditor.loading=false;state.catalogEditor.error=String(err.message||err);render()}
  } else {state.catalogEditor.validation=demoValidateDraft(state.catalogEditor.draft);render()}
}

function catalogValidationMarkup(v){if(!v)return'';const errs=v.errors||[],warn=v.warnings||[];return `<div data-catalog-validation class="catalogValidation ${v.valid?'valid':'invalid'}"><div><strong>${v.valid?'Ready to apply':'Needs attention'}</strong><span>${v.valid?`${v.saleReadyEditionCount||0} sale-ready edition${(v.saleReadyEditionCount||0)===1?'':'s'}`:`${errs.length} blocking issue${errs.length===1?'':'s'}`}</span></div>${errs.length?`<ul>${errs.map(x=>`<li>${esc(x.replaceAll('_',' '))}</li>`).join('')}</ul>`:''}${warn.length?`<small>${warn.map(x=>esc(x.replaceAll('_',' '))).join(' · ')}</small>`:''}</div>`}

function catalogEditorModal(){
  const x=state.catalogEditor;if(!x)return'';if(x.loading)return `<div class="catalogEditorShade"><section class="catalogEditor loadingEditor">${loadingState('Loading catalog editor…')}</section></div>`;
  if(x.error)return `<div class="catalogEditorShade"><section class="catalogEditor"><button class="catalogClose" data-close-catalog>×</button>${errorState('Catalog editor could not load',x.error)}</section></div>`;
  const d=x.draft,b=x.book;
  return `<div class="catalogEditorShade"><section class="catalogEditor" role="dialog" aria-modal="true" aria-label="Edit ${esc(b.title)}"><header class="catalogEditorHead"><div><span class="microLabel">CATALOG EDITOR · REV ${x.listingRevision}</span><h2>${esc(d.book.displayTitle||b.title)}</h2><p><span class="autosaveDot"></span><span id="catalogSaveState">${x.savedAt?'Saved':'Autosave ready'}</span></p></div><div><button class="btn secondary" data-close-catalog>Close</button><button class="btn primary" data-apply-catalog ${x.validation&&!x.validation.valid?'disabled':''}>Apply changes</button></div></header><div class="catalogEditorBody"><div class="catalogFormPane">
  <section class="catalogSection"><div class="catalogSectionHead"><div><span class="microLabel">LISTING</span><h3>What readers see</h3></div><span>Marketplace-owned</span></div><label>Title<input data-cat="book.displayTitle" value="${esc(d.book.displayTitle||'')}" maxlength="180"></label><label>Subtitle<input data-cat="book.displaySubtitle" value="${esc(d.book.displaySubtitle||'')}" maxlength="220"></label><label>Cover URL<input data-cat="book.coverUrl" value="${esc(d.book.coverUrl||'')}" placeholder="https://"></label><label>Short description<textarea data-cat="book.description" rows="3">${esc(d.book.description||'')}</textarea></label><label>Full description<textarea data-cat="book.longDescription" rows="6">${esc(d.book.longDescription||'')}</textarea></label><div class="catalogTwo"><label>Category<input data-cat="book.primaryCategory" value="${esc(d.book.primaryCategory||'')}"></label><label>Visibility<select data-cat="listing.visibility"><option value="public" ${d.listing.visibility==='public'?'selected':''}>Public</option><option value="direct" ${d.listing.visibility==='direct'?'selected':''}>Direct link only</option><option value="private" ${d.listing.visibility==='private'?'selected':''}>Private</option></select></label></div><label>Excerpt / preview copy<textarea data-cat="book.excerpt" rows="3">${esc(d.book.excerpt||'')}</textarea></label></section>
  <section class="catalogSection"><div class="catalogSectionHead"><div><span class="microLabel">EDITIONS</span><h3>Price & availability</h3></div><span>Production fields locked</span></div><div class="catalogEditions">${b.editions.map(e=>{const de=d.editions.find(z=>z.id===e.id)||{id:e.id,priceMinor:e.priceMinor||0,status:e.status};return`<div class="catalogEdition"><div><span class="formatIcon">${formatLabel(e.format)[0]}</span><span><strong>${esc(formatLabel(e.format))}</strong><small>${e.isbn?`ISBN ${esc(e.isbn)}`:'Digital edition'} · ${e.fulfillment==='ingram'?'Ingram':'YasReady digital'}</small></span></div><label>Price<input type="number" min="0" step="0.01" data-edition-price="${e.id}" value="${(Number(de.priceMinor||0)/100).toFixed(2)}"></label><label>Status<select data-edition-status="${e.id}"><option value="draft" ${de.status==='draft'?'selected':''}>Draft</option><option value="live" ${de.status==='live'?'selected':''}>Live</option><option value="paused" ${de.status==='paused'?'selected':''}>Paused</option></select></label></div>`}).join('')}</div></section>
  <section class="catalogSection"><div class="catalogSectionHead"><div><span class="microLabel">AUTHOR STOREFRONT</span><h3>Your reader-facing profile</h3></div><span>Shared YasReady account</span></div><label>Display name<input data-cat="author.displayName" value="${esc(d.author.displayName||'')}"></label><label>Storefront tagline<input data-cat="author.storefrontTagline" value="${esc(d.author.storefrontTagline||'')}" placeholder="Stories about…"></label><label>Bio<textarea data-cat="author.bio" rows="4">${esc(d.author.bio||'')}</textarea></label><label>Website<input data-cat="author.websiteUrl" value="${esc(d.author.websiteUrl||'')}" placeholder="https://"></label></section>
  <section class="catalogSection"><div class="catalogSectionHead"><div><span class="microLabel">DISCOVERY</span><h3>SEO & launch</h3></div><span>Optional</span></div><label>SEO title<input data-cat="listing.seoTitle" value="${esc(d.listing.seoTitle||'')}"></label><label>SEO description<textarea data-cat="listing.seoDescription" rows="3">${esc(d.listing.seoDescription||'')}</textarea></label><label>Planned launch date <small>Planning only — does not auto-publish automatically.</small><input type="datetime-local" data-cat="listing.launchAt" value="${esc((d.listing.launchAt||'').replace('Z','').slice(0,16))}"></label></section>
  ${x.history?.length?`<section class="catalogSection"><div class="catalogSectionHead"><div><span class="microLabel">CHANGE HISTORY</span><h3>Recent applied revisions</h3></div><span>Audited</span></div><div class="catalogHistory">${x.history.slice(0,5).map(h=>`<div><strong>Revision ${h.listing_revision}</strong><span>${esc((h.changedFields||[]).join(', ')||'No field list')}</span><small>${esc(h.created_at)}</small></div>`).join('')}</div></section>`:''}
  </div><aside class="catalogPreviewPane"><div class="catalogPreviewSticky"><span class="microLabel">LIVE PREVIEW</span><div class="previewBookCard"><div class="previewCover" style="background:${coverTheme(b)}"><span>YASREADY BOOKS</span><strong data-preview-title>${esc(d.book.displayTitle||b.title)}</strong></div><div><span data-preview-category>${esc(d.book.primaryCategory||'Independent book')}</span><h3 data-preview-title2>${esc(d.book.displayTitle||b.title)}</h3><p data-preview-subtitle>${esc(d.book.displaySubtitle||'')}</p><small>by <span data-preview-author>${esc(d.author.displayName||state.account.name)}</span></small><p data-preview-description>${esc(d.book.description||'Add a short description to help readers discover this book.')}</p><div class="previewFormats">${b.editions.map(e=>{const de=d.editions.find(z=>z.id===e.id)||e;return`<span>${esc(formatLabel(e.format))} · ${moneyMinor(de.priceMinor||0)}</span>`}).join('')}</div></div></div>${catalogValidationMarkup(x.validation)}<div class="previewHelp"><strong>Preview before publish</strong><p>Autosave changes stay in a working draft. The live listing only changes when you choose <b>Apply changes</b>.</p></div></div></aside></div></section></div>`;
}

function launchView(){
  const mine=myBooks();
  return `<main class="view creatorView">${pageHead('Publishing handoff','Your finished book arrives here — still safely in draft.','Publishing sends production truth into the same YasReady account. Marketplace keeps commercial control, shows what changed, and waits for you to approve the sale.',`<button class="btn secondary" data-nav="books">Review books</button><button class="btn primary" data-nav="marketing">Open Promote</button>`)}
  <div class="shell">${sharedAccountCard()}
    <div class="noticeBar"><div class="noticeIcon">↔</div><div><strong>One-way by design.</strong><span>Publishing can send title, cover, ISBNs, formats and production artifacts. It cannot change your Marketplace price, campaigns, visibility or make a book live.</span></div></div>
    <div class="twoCol dashboardMain"><section class="panel"><div class="panelHead"><div><span class="microLabel">HANDSHAKE CONTRACT</span><h2>Signed. Idempotent. Account-bound.</h2></div><span class="freeTag">v1</span></div><div class="flowList"><div><strong>1 · Publishing finishes production</strong><span>A versioned package is signed and sent to Marketplace.</span></div><div><strong>2 · Same YasReady user is matched</strong><span>No new author account and no second password.</span></div><div><strong>3 · Production truth syncs</strong><span>ISBNs, formats, cover and artifact provenance update safely.</span></div><div><strong>4 · Commercial choices are preserved</strong><span>Marketplace price and live status never get silently overwritten.</span></div><div><strong>5 · Author approves launch</strong><span>Only you can turn selected editions on for sale.</span></div></div></section>
    <section class="panel"><div class="panelHead"><div><span class="microLabel">SAFETY</span><h2>Publishing cannot push a book live.</h2></div></div><div class="integrationMini"><strong>Service signature</strong><span>HMAC timestamp + payload verification</span></div><div class="integrationMini"><strong>Replay protection</strong><span>Source book + SHA-256 payload hash</span></div><div class="integrationMini"><strong>Ownership lock</strong><span>Source book cannot jump YasReady users</span></div><div class="integrationMini"><strong>Field ownership</strong><span>Production truth syncs; Marketplace truth stays put</span></div><div class="integrationMini"><strong>Author launch gate</strong><span>Explicit readiness check before live</span></div></section></div>
    <section class="panel"><div class="panelHead"><div><span class="microLabel">BOOKS FROM PUBLISHING</span><h2>${mine.length} linked books ready for Marketplace review</h2></div><span class="subtle">Demo account</span></div><div class="manageBooks">${mine.map(b=>`<article class="manageBook"><div class="manageCover">${cover(b,true)}</div><div class="manageBody"><div class="manageTitle"><div><span class="liveBadge">${b.listingStatus==='live'?'Already live':'Production synced'}</span><h2>${esc(b.title)}</h2><p>${b.editions.length} editions · same YasReady account</p></div></div><div class="editionTable">${b.editions.map(e=>`<div class="editionRow"><div><span class="formatIcon">${formatLabel(e.format)[0]}</span><div><strong>${esc(formatLabel(e.format))}</strong><small>${e.isbn?`ISBN ${esc(e.isbn)}`:'Digital edition'}</small></div></div><div><strong>${money(e.price)}</strong><small>${e.status==='live'?'For sale':'Review before launch'}</small></div></div>`).join('')}</div><div class="manageActions"><button class="btn secondary small" data-nav="books">Review listing</button><button class="btn primary small" data-launch-book="${b.id}">${b.listingStatus==='live'?'Check readiness':'Approve for sale'}</button></div></div></article>`).join('')}</div></section>
    <section class="panel dataContract"><div><div class="microLabel">VERSIONED PACKAGE</div><h2>Publishing sends only what Marketplace needs.</h2><p>The receiving contract is intentionally small and durable. Marketplace stores the source revision and artifact hashes so every commercial listing can trace back to the production version that created it.</p></div><pre>{
  "schema": "yasready.publishing.marketplace.v1",
  "userId": "same-yasready-account",
  "sourceBookId": "publishing-book-id",
  "sourceRevision": "production-revision",
  "book": { "title": "...", "coverUrl": "..." },
  "editions": [
    { "sourceEditionId": "...", "format": "paperback", "isbn": "..." }
  ]
}</pre></section>
  </div></main>`;
}

function salesView(){const d=state.dashboard;return `<main class="view creatorView">${pageHead('Sales intelligence','Know what sold — and what caused it.','Marketplace captures orders and marketing attribution together so authors are not stitching together screenshots from five different tools.',`<button class="btn secondary" data-export-business>Preview Business feed</button>`)}
<div class="shell"><div class="metricsGrid five">${metric('Gross sales',money(d.grossSales),d.period,'purple')}${metric('Author earnings',money(d.authorEarnings),'After modeled costs','limeCard')}${metric('Orders',d.orders,`${d.units} units`)}${metric('Avg. order',money(d.avgOrderValue),'Across all formats')}${metric('Refunds',d.refunds,'Tracked separately')}</div>
<div class="twoCol salesLayout"><section class="panel"><div class="panelHead"><div><span class="microLabel">FORMAT MIX</span><h2>What readers buy</h2></div></div><div class="formatMix">${d.formatMix.map(x=>`<div class="mixRow"><div><strong>${x.label}</strong><span>${money(x.amount)}</span></div><div class="mixTrack"><i style="width:${x.value}%"></i></div><b>${x.value}%</b></div>`).join('')}</div></section>
<section class="panel"><div class="panelHead"><div><span class="microLabel">ATTRIBUTION</span><h2>What actually sells books</h2></div></div><div class="sourceTable"><div class="sourceHead"><span>Source</span><span>Visits</span><span>Orders</span><span>Revenue</span><span>Conv.</span></div>${d.sources.map(x=>`<div class="sourceRow"><strong>${x.source}</strong><span>${x.visits.toLocaleString()}</span><span>${x.sales}</span><span>${money(x.revenue)}</span><span>${x.conversion}%</span></div>`).join('')}</div></section></div>
<section class="panel ordersPanel"><div class="panelHead"><div><span class="microLabel">RECENT ORDERS</span><h2>Money and fulfillment stay separate</h2></div><span class="subtle">Payment state ≠ print state</span></div><div class="ordersTable"><div class="ordersHead"><span>Order</span><span>Book</span><span>Format</span><span>Gross</span><span>Your earnings</span><span>Status</span></div>${d.recentOrders.map(o=>`<div class="orderRow"><span><strong>${o.id}</strong><small>${o.when}</small></span><span>${esc(o.title)}</span><span>${o.format}</span><span>${money(o.gross)}</span><span>${money(o.earnings)}</span><span><i class="orderDot"></i>${o.status}</span></div>`).join('')}</div></section><section class="channelLane"><div><span class="microLabel">EXTERNAL SALES LANE</span><h3>Ingram network stats have their own pipe.</h3><p>External retailer/distribution reports land separately by provider, channel, ISBN, date and provenance. They can be shown alongside direct YasReady sales without quietly double-counting the same order.</p></div><div class="channelState"><span>Ingram</span><strong>Report adapter ready</strong><small>Import disabled until feed format + credentials are approved.</small></div></section></div></main>`}

function commerceView(){
  const d=state.dashboard;
  const gross=d.grossSales||248641, earned=d.authorEarnings||189420;
  return `<main class="view creatorView">${pageHead('Commerce','Every dollar has a paper trail.','Commerce keeps the immutable ledger intact while the signed Publishing handoff and author-controlled launch gate remain separate.',`<button class="btn secondary" data-nav="sales">Sales intelligence</button><button class="btn primary" data-nav="integrations">Provider status</button>`)}
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
  return `<main class="view creatorView">${pageHead('Fulfillment','Ingram truth without pretending we have an API we don’t.','The Ingram Bridge remains isolated from Publishing: metadata, stock, purchase order, acknowledgment, pick/pack, shipment notice and invoice stay behind explicit provider gates.',`<button class="btn secondary" data-nav="commerce">Commerce</button><button class="btn primary" data-nav="integrations">Connection status</button>`)}
  <div class="shell"><div class="metricsGrid five">${metric('Queued','3','Physical items awaiting provider action','purple')}${metric('Acknowledged','12','Provider accepted','limeCard')}${metric('Shipped','18','Tracking captured')}${metric('Exceptions','1','Held from auto-retry')}${metric('Last sync','Demo','Provider transport remains off')}</div>
  <section class="panel"><div class="panelHead"><div><span class="microLabel">INGRAM BRIDGE</span><h2>One normalized fulfillment lifecycle.</h2></div><span class="safePill">SUBMISSION OFF</span></div>
  <div class="systemFlow"><div><span class="systemIcon">M</span><strong>Metadata</strong><p>Title, author, ISBN and cover snapshots.</p></div><i>→</i><div><span class="systemIcon">S</span><strong>Stock</strong><p>Availability and provider-cost snapshots.</p></div><i>→</i><div class="activeSystem"><span class="systemIcon">PO</span><strong>Fulfillment</strong><p>PO → POA → Pick/Pack → ASN → Invoice.</p></div></div></section>
  <div class="twoCol dashboardMain"><section class="panel"><div class="panelHead"><div><span class="microLabel">FULFILLMENT QUEUE</span><h2>Every physical item gets its own job.</h2></div></div><div class="flowList">${jobs.map(j=>`<div><strong>${j.order} · ${esc(j.book)}</strong><span>${j.format} · ${j.stage}<br>${j.detail}</span></div>`).join('')}</div></section>
  <section class="panel"><div class="panelHead"><div><span class="microLabel">FAIL-SAFE OPERATIONS</span><h2>Automation cannot hide failure.</h2></div></div><div class="integrationMini"><strong>Idempotent provider documents</strong><span>Duplicate POA/ASN/invoice events do not duplicate state.</span></div><div class="integrationMini"><strong>Retry ledger</strong><span>Attempts, backoff and last error stay inspectable.</span></div><div class="integrationMini"><strong>Dead-letter queue</strong><span>Unmatched or malformed provider records wait for human review.</span></div><div class="integrationMini"><strong>Cost reconciliation</strong><span>Provider invoices update actual fulfillment cost without rewriting checkout history.</span></div></section></div>
  <section class="panel dataContract"><div><div class="microLabel">WHAT WE CAN CONNECT WHEN INGRAM APPROVES IT</div><h2>The transport is replaceable; Marketplace stays the same.</h2><p>Marketplace prepares normalized envelopes and consumes normalized provider documents. Whatever approved transport Ingram provides later can plug into this boundary without rewriting the storefront, Publishing handshake or commerce ledger.</p></div><pre>{
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

function integrationsView(){return `<main class="view creatorView">${pageHead('Connections','One YasReady account. Clean product boundaries.','v0.8.0 keeps identity, Publishing handoff, payments, fulfillment and Business analytics inside one consistent YasReady operating system.')}
<div class="shell"><div class="integrationGrid">${integrationCard('Y','YasReady Account','Connected','The same central account used in Publishing becomes the Marketplace author identity. No second signup.','Shared identity','connected')}${integrationCard('S','Stripe Connect','Ready for test credentials','Express onboarding hooks, Checkout Sessions, webhooks, multi-seller allocation and reconciliation boundaries are in the Worker.','Payments + payouts','ready')}${integrationCard('I','Ingram','Partner-ready boundary','Share & Sell fallback plus metadata, stock, Consumer Direct Fulfillment and EDI lifecycle seams. Live fulfillment waits for an approved Ingram relationship.','Print fulfillment','ready')}${integrationCard('B','Business | YasReady','Export contract built','A normalized commercial feed already exposes gross sales, fees, fulfillment costs, author payable, formats and campaign performance.','Business intelligence','future')}</div>
<section class="panel architecturePanel"><div class="panelHead"><div><span class="microLabel">PRODUCTION SAFETY</span><h2>Things that stay off until they’re real.</h2></div></div><div class="safetyGrid"><div><span class="offPill">OFF</span><strong>Live checkout</strong><p>`+'`CHECKOUT_ENABLED=false`'+` is the tracked default.</p></div><div><span class="offPill">OFF</span><strong>Stripe live mode</strong><p>Requires secret + webhook configuration.</p></div><div><span class="offPill">OFF</span><strong>Ingram order submission</strong><p>No undocumented API calls or fake credentials.</p></div><div><span class="offPill">OFF</span><strong>Publishing transport</strong><p>The signed receiving contract is built, but PUBLISHING_IMPORT_ENABLED=false remains the tracked default and author launch approval is separate.</p></div></div></section>
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
  const live=liveEditions(b),digital=live.filter(e=>['Ebook','Audiobook'].includes(formatLabel(e.format)));
  return `<div class="modalShade" data-close-book><div class="bookModal consumerBookModal" onclick="event.stopPropagation()"><button class="modalClose" data-close-book>×</button><div class="modalCover">${cover(b)}${saveButton(b)}</div><div class="modalBody"><span class="kicker">${esc((b.categories||[])[0]||b.category||'Independent book')}</span><h1>${esc(b.title)}</h1><h3>${esc(b.subtitle||'')}</h3><p class="byline">by <button class="authorLink" data-author="${esc(b.handle||'')}">${esc(b.author)}</button></p>${b.series?`<button class="seriesCallout" data-series="${encodeURIComponent(b.series)}">${esc(b.series)}${b.seriesNumber?` · Book ${b.seriesNumber}`:''} →</button>`:''}<p class="modalDesc">${esc(b.longDescription||b.description)}</p><div class="modalRating">★ ${b.rating||'New'} ${b.reviews?`· ${b.reviews} reader reviews`:''}</div>${digital.length?`<div class="digitalPromise"><strong>Digital editions live in your YasReady library.</strong><span>Buy an ebook or audiobook here and it’s ready for the YasReady. Books reader/listener experience.</span></div>`:''}<div class="buyFormats"><h4>Choose your format</h4>${b.editions.map(e=>`<div class="buyRow ${e.status!=='live'?'disabled':''}"><div><strong>${esc(formatLabel(e.format))}</strong><span>${e.isbn?`ISBN ${esc(e.isbn)}`:(formatLabel(e.format)==='Audiobook'?'Listen in YasReady. Books':'Read in YasReady. Books')}</span></div><div><strong>${money(e.price)}</strong>${e.status==='live'?`<button class="btn primary small" data-add="${b.id}|${e.id}">Add</button>`:`<span class="editionState">${esc(e.status)}</span>`}</div></div>`).join('')}</div><div class="reviewPreview"><strong>Reader response</strong><span>★ ${b.rating||'New'} · ${b.reviews||0} reviews</span><p>Marketplace reviews are designed to stay attached to the book across every format.</p></div></div></div></div>`;
}

function cartDrawer(){
  const total=state.cart.reduce((a,x)=>a+x.price,0),sellers=new Set(state.cart.map(x=>x.authorId)).size;
  return `<div class="drawerShade" data-close-cart><aside class="cartDrawer" onclick="event.stopPropagation()"><div class="drawerHead"><div><span class="microLabel">YOUR BAG</span><h2>${state.cart.length} ${state.cart.length===1?'item':'items'}</h2></div><button data-close-cart>×</button></div>${state.cart.length?`<div class="cartItems">${state.cart.map((x,i)=>`<div class="cartItem"><div><strong>${esc(x.title)}</strong><span>${esc(x.author)} · ${esc(x.format)}</span></div><div><strong>${money(x.price)}</strong><button data-remove="${i}">Remove</button></div></div>`).join('')}</div><div class="cartSummary"><div><span>Subtotal</span><strong>${money(total)}</strong></div><div><span>Independent authors</span><strong>${sellers}</strong></div></div><button class="btn primary wide" data-demo-checkout>Continue to checkout</button><p class="cartFine">v0.8 validates edition price and seller server-side before Stripe. Stripe test checkout is wired behind server-side safety gates; live money remains intentionally disabled in this package.</p>`:`<div class="emptyCart"><strong>Your bag is empty.</strong><p>Add an edition from any Marketplace listing.</p></div>`}</aside></div>`;
}

function loadingState(label='Loading Marketplace…'){
  return `<main class="view creatorView"><div class="shell"><div class="stateCard" role="status"><div class="stateSpinner" aria-hidden="true"></div><div><span class="microLabel">YASREADY</span><h2>${esc(label)}</h2><p>Keeping your workspace in sync.</p></div></div><div class="skeletonGrid">${Array.from({length:4},()=>'<div class="skeletonCard"><i></i><b></b><span></span></div>').join('')}</div></div></main>`;
}
function errorState(title='Something needs attention',copy='Marketplace could not finish that request. Your existing data has not been changed.'){
  return `<div class="stateCard errorState" role="alert"><div class="stateIcon">!</div><div><span class="microLabel">NOT CHANGED</span><h2>${esc(title)}</h2><p>${esc(copy)}</p></div></div>`;
}

function render(){
  const views={store:storeView,library:libraryView,saved:savedView,authorpage:authorPageView,seriespage:seriesPageView,dashboard:dashboardView,books:booksView,launch:launchView,sales:salesView,commerce:commerceView,fulfillment:fulfillmentView,marketing:marketingView,integrations:integrationsView};
  const creator=!isPublicView();
  document.body.classList.toggle('creator-ui',creator);document.body.classList.toggle('reader-ui',!creator);
  const footerCopy=creator?'Make it. Sell it. Understand it.':'Read. Listen. Discover independent stories.';
  app.innerHTML=shell()+(state.loading?loadingState():(views[state.view]||storeView)())+`<footer><div class="shell"><div>${brandMark}<strong>Marketplace <span>|</span> YasReady</strong></div><p>${footerCopy}</p><span>v0.8.0 · Consumer Marketplace Closure</span></div></footer>`+(state.selected?bookModal(state.selected):'')+(state.catalogEditor?catalogEditorModal():'');
  bind();if(state.view==='marketing'&&!state.loading)setupMarketing();
}

function toast(msg){const x=document.createElement('div');x.className='toast';x.textContent=msg;document.body.append(x);setTimeout(()=>x.remove(),2600)}
function navigate(view){state.view=view;state.selected=null;history.replaceState({},'',location.pathname+location.search);track('navigation',{view});render();scrollTo({top:0,behavior:'smooth'})}

function bind(){
  document.querySelectorAll('[data-nav]').forEach(x=>x.onclick=()=>navigate(x.dataset.nav));
  document.querySelector('[data-theme-toggle]')?.addEventListener('click',()=>{setTheme(currentTheme()==='dark'?'light':'dark');render();track('appearance_changed',{theme:currentTheme()})});
  document.querySelector('[data-cart]')?.addEventListener('click',()=>{document.body.insertAdjacentHTML('beforeend',cartDrawer());bindCart();track('cart_opened')});
  document.querySelectorAll('[data-book]').forEach(x=>x.onclick=()=>{state.selected=state.books.find(b=>b.id===x.dataset.book);if(state.selected)recordRecent(state.selected.id);track('book_viewed',{bookId:state.selected?.id});render()});
  document.querySelectorAll('[data-save]').forEach(x=>x.onclick=async e=>{e.stopPropagation();const id=x.dataset.save,on=state.reader.saved.includes(id);state.reader.saved=on?state.reader.saved.filter(z=>z!==id):[id,...state.reader.saved];persistReader();if(state.api)authFetch(`/api/reader/saved/${encodeURIComponent(id)}`,{method:on?'DELETE':'POST'}).catch(()=>{});track(on?'book_unsaved':'book_saved',{bookId:id});render();toast(on?'Removed from saved':'Saved for later')});
  document.querySelectorAll('[data-author]').forEach(x=>x.onclick=e=>{e.stopPropagation();state.publicAuthorHandle=x.dataset.author;state.view='authorpage';state.selected=null;render();scrollTo({top:0,behavior:'smooth'})});
  document.querySelectorAll('[data-series]').forEach(x=>x.onclick=e=>{e.stopPropagation();state.publicSeries=decodeURIComponent(x.dataset.series);state.view='seriespage';state.selected=null;render();scrollTo({top:0,behavior:'smooth'})});
  document.querySelectorAll('[data-category]').forEach(x=>x.onclick=()=>{state.query=x.dataset.category;state.view='store';render();setTimeout(()=>document.querySelector('#browse')?.scrollIntoView({behavior:'smooth'}),0)});
  document.querySelectorAll('[data-open-library]').forEach(x=>x.onclick=()=>{const [bookId,editionId,format]=x.dataset.openLibrary.split('|');toast(`${format==='Audiobook'?'Player':'Reader'} preview · YasReady. Books is the next consumer layer`);track('library_item_opened',{bookId,editionId,format})});
  document.querySelectorAll('[data-follow]').forEach(x=>x.onclick=()=>{toast('Author followed');if(state.api)authFetch(`/api/reader/follow/${encodeURIComponent(x.dataset.follow)}`,{method:'POST'}).catch(()=>{});track('author_followed',{authorId:x.dataset.follow})});
  const heroSearch=document.querySelector('#heroSearch');if(heroSearch)heroSearch.onkeydown=e=>{if(e.key==='Enter'){state.query=e.target.value;render();setTimeout(()=>document.querySelector('#browse')?.scrollIntoView({behavior:'smooth'}),0)}};
  document.querySelectorAll('[data-promote]').forEach(x=>x.onclick=()=>{state.marketingBookId=x.dataset.promote;navigate('marketing')});
  document.querySelectorAll('[data-edit-catalog]').forEach(x=>x.onclick=()=>openCatalogEditor(x.dataset.editCatalog));
  document.querySelectorAll('[data-close-catalog]').forEach(x=>x.onclick=()=>{state.catalogEditor=null;render()});
  document.querySelector('[data-apply-catalog]')?.addEventListener('click',applyCatalogEditor);
  bindCatalogInputs();
  document.querySelectorAll('[data-close-book]').forEach(x=>x.onclick=()=>{state.selected=null;render()});
  document.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>{
    const [bid,eid]=x.dataset.add.split('|'),b=state.books.find(z=>z.id===bid),e=b.editions.find(z=>z.id===eid);state.cart.push({bookId:b.id,editionId:e.id,title:b.title,author:b.author,authorId:b.authorId,format:formatLabel(e.format),price:e.price,priceMinor:e.priceMinor||Math.round(e.price*100),fulfillment:e.fulfillment});persistCart();track('cart_item_added',{bookId:b.id,editionId:e.id,format:e.format,price:e.price,authorId:b.authorId});toast(`${formatLabel(e.format)} added to bag`);render();
  });
  document.querySelectorAll('[data-filter]').forEach(x=>x.onclick=()=>{state.filter=x.dataset.filter;track('catalog_filtered',{filter:state.filter});render();setTimeout(()=>document.querySelector('#browse')?.scrollIntoView(),0)});
  const s=document.querySelector('#search');if(s)s.oninput=e=>{state.query=e.target.value;clearTimeout(window.__q);window.__q=setTimeout(()=>{track('catalog_searched',{query:state.query});render();document.querySelector('#search')?.focus()},160)};
  document.querySelectorAll('[data-scroll]').forEach(x=>x.onclick=()=>document.querySelector('#'+x.dataset.scroll)?.scrollIntoView({behavior:'smooth'}));
  document.querySelectorAll('[data-launch-book]').forEach(x=>x.onclick=async()=>{
    const bookId=x.dataset.launchBook;
    if(!state.api){toast('Publishing handshake ready · author go-live gate is built');track('publishing_launch_previewed',{bookId});return;}
    try{const r=await authFetch(`/api/me/books/${encodeURIComponent(bookId)}/readiness`,{headers:{accept:'application/json'}}),d=await r.json();if(!r.ok)throw new Error(d.error||'readiness_failed');if(!d.readiness?.ready){toast(`Needs ${d.readiness?.errors?.length||1} fix${(d.readiness?.errors?.length||1)===1?'':'es'} before sale`);return;}const go=await authFetch(`/api/me/books/${encodeURIComponent(bookId)}/go-live`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({editionIds:d.readiness.eligibleEditionIds})}),g=await go.json();if(!go.ok)throw new Error(g.error||'go_live_failed');toast('Book is live on YasReady Marketplace');await hydrateFromApi();}catch(err){toast(String(err.message||err))}
  });
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
  return {id:b.id,slug:b.slug,title:b.title,subtitle:b.subtitle,author:b.author?.name||state.account.name||'YasReady Author',authorBio:b.author?.bio||null,authorTagline:b.author?.storefrontTagline||null,authorId:b.author?.id||state.account.authorId,handle:b.author?.handle||state.account.handle,description:b.description,longDescription:b.longDescription,coverUrl:b.coverUrl||null,cover:b.coverUrl?`url(${b.coverUrl}) center/cover` : undefined,categories:[b.category].filter(Boolean),category:b.category,excerpt:b.excerpt||null,series:b.series||null,seriesNumber:b.seriesNumber??null,listingStatus:b.listing?.status||'draft',visibility:b.listing?.visibility||'public',listingRevision:Number(b.listing?.editorRevision??b.listing?.revision??0),seoTitle:b.listing?.seoTitle||null,seoDescription:b.listing?.seoDescription||null,launchAt:b.listing?.scheduledLiveAt||null,editions:(b.editions||[]).map(e=>({id:e.id,format:formatLabel(e.format),price:(e.priceMinor||0)/100,priceMinor:e.priceMinor,isbn:e.isbn,status:e.status,fulfillment:e.fulfillmentProvider,inventoryStatus:e.inventoryStatus,productionStatus:e.productionStatus}))};
}

function setDeep(obj,path,value){const parts=path.split('.');let cur=obj;for(let i=0;i<parts.length-1;i++){cur[parts[i]]??={};cur=cur[parts[i]]}cur[parts.at(-1)]=value}
function collectCatalogForm(){const x=state.catalogEditor;if(!x)return null;const draft=structuredClone(x.draft);document.querySelectorAll('[data-cat]').forEach(el=>setDeep(draft,el.dataset.cat,el.value||null));document.querySelectorAll('[data-edition-price]').forEach(el=>{const e=draft.editions.find(z=>z.id===el.dataset.editionPrice);if(e)e.priceMinor=Math.max(0,Math.round((Number(el.value)||0)*100))});document.querySelectorAll('[data-edition-status]').forEach(el=>{const e=draft.editions.find(z=>z.id===el.dataset.editionStatus);if(e)e.status=el.value});return draft}
function updateCatalogValidationDom(v){const old=document.querySelector('[data-catalog-validation]');if(old)old.outerHTML=catalogValidationMarkup(v);const btn=document.querySelector('[data-apply-catalog]');if(btn)btn.disabled=!v?.valid}
function updateCatalogPreview(){const d=collectCatalogForm();if(!d)return;state.catalogEditor.draft=d;document.querySelectorAll('[data-preview-title]').forEach(x=>x.textContent=d.book.displayTitle||'Untitled');document.querySelectorAll('[data-preview-title2]').forEach(x=>x.textContent=d.book.displayTitle||'Untitled');document.querySelector('[data-preview-subtitle]')?.replaceChildren(document.createTextNode(d.book.displaySubtitle||''));document.querySelector('[data-preview-category]')?.replaceChildren(document.createTextNode(d.book.primaryCategory||'Independent book'));document.querySelector('[data-preview-description]')?.replaceChildren(document.createTextNode(d.book.description||'Add a short description to help readers discover this book.'));document.querySelector('[data-preview-author]')?.replaceChildren(document.createTextNode(d.author.displayName||state.account.name||'YasReady Author'));const pf=document.querySelector('.previewFormats');if(pf)pf.innerHTML=state.catalogEditor.book.editions.map(e=>{const de=d.editions.find(z=>z.id===e.id)||e;return`<span>${esc(formatLabel(e.format))} · ${moneyMinor(de.priceMinor||0)}</span>`}).join('')}
let catalogSaveTimer=null;
function bindCatalogInputs(){if(!state.catalogEditor)return;document.querySelectorAll('.catalogEditor [data-cat],.catalogEditor [data-edition-price],.catalogEditor [data-edition-status]').forEach(el=>{el.addEventListener('input',()=>{updateCatalogPreview();const st=document.querySelector('#catalogSaveState');if(st)st.textContent='Unsaved changes';clearTimeout(catalogSaveTimer);catalogSaveTimer=setTimeout(saveCatalogEditor,700)});el.addEventListener('change',()=>{updateCatalogPreview();clearTimeout(catalogSaveTimer);catalogSaveTimer=setTimeout(saveCatalogEditor,250)})})}
async function saveCatalogEditor(){const x=state.catalogEditor;if(!x)return;const draft=collectCatalogForm()||x.draft;x.draft=draft;x.saving=true;const st=document.querySelector('#catalogSaveState');if(st)st.textContent='Saving…';if(!state.api){try{localStorage.setItem(`yr.market.catalog.${x.bookId}`,JSON.stringify(draft))}catch{}x.draftRevision++;x.validation=demoValidateDraft(draft);x.savedAt=new Date().toISOString();x.saving=false;updateCatalogValidationDom(x.validation);if(st)st.textContent='Saved locally';return}
  try{const r=await authFetch(`/api/me/books/${encodeURIComponent(x.bookId)}/editor`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({baseDraftRevision:x.draftRevision,draft})}),d=await r.json();if(!r.ok)throw new Error(d.error||'catalog_save_failed');x.draft=d.draft;x.draftRevision=d.draftRevision;x.validation=d.validation;x.savedAt=d.savedAt;x.saving=false;updateCatalogValidationDom(d.validation);if(st)st.textContent='Saved'}catch(err){x.saving=false;if(st)st.textContent='Save failed';toast(String(err.message||err))}}
async function applyCatalogEditor(){const x=state.catalogEditor;if(!x)return;await saveCatalogEditor();if(!x.validation?.valid){toast('Fix the catalog issues before applying');return}if(!state.api){const b=state.books.find(z=>z.id===x.bookId);if(b){b.title=x.draft.book.displayTitle||b.title;b.subtitle=x.draft.book.displaySubtitle;b.description=x.draft.book.description;b.longDescription=x.draft.book.longDescription;b.category=x.draft.book.primaryCategory;b.categories=[b.category].filter(Boolean);b.listingRevision=(b.listingRevision||0)+1;for(const de of x.draft.editions){const e=b.editions.find(z=>z.id===de.id);if(e){e.priceMinor=de.priceMinor;e.price=de.priceMinor/100;e.status=de.status}}}state.catalogEditor=null;toast('Catalog changes applied in demo mode');render();return}
  try{const r=await authFetch(`/api/me/books/${encodeURIComponent(x.bookId)}/apply-draft`,{method:'POST'}),d=await r.json();if(!r.ok)throw new Error(d.error||'catalog_apply_failed');toast(`Catalog revision ${d.revision} applied`);state.catalogEditor=null;await hydrateFromApi()}catch(err){toast(String(err.message||err))}}

async function hydrateFromApi(){
  try{
    const [catalogRes,sessionRes,myRes,libRes,savedRes,recentRes]=await Promise.all([fetch('/api/catalog',{headers:{accept:'application/json'}}),authFetch('/api/session',{headers:{accept:'application/json'}}),authFetch('/api/me/books',{headers:{accept:'application/json'}}),authFetch('/api/reader/library',{headers:{accept:'application/json'}}),authFetch('/api/reader/saved',{headers:{accept:'application/json'}}),authFetch('/api/reader/recent',{headers:{accept:'application/json'}})]);
    if(!catalogRes.ok||!sessionRes.ok) return;
    const catalog=await catalogRes.json(),session=await sessionRes.json(),myPayload=myRes.ok?await myRes.json():{books:[]},libPayload=libRes.ok?await libRes.json():null,savedPayload=savedRes.ok?await savedRes.json():null,recentPayload=recentRes.ok?await recentRes.json():null;
    if(session.author){state.account={userId:session.identity.userId,name:session.author.displayName,email:session.author.email,authorId:session.author.id,handle:session.author.handle,bio:session.author.bio,websiteUrl:session.author.websiteUrl,storefrontTagline:session.author.storefrontTagline,sharedAccount:true};}
    const pub=(catalog.books||[]).map(adaptApiBook),owned=(myPayload.books||[]).map(b=>adaptApiBook({...b,author:{id:state.account.authorId,name:state.account.name,handle:state.account.handle}}));const merged=new Map(pub.map(b=>[b.id,b]));for(const b of owned)merged.set(b.id,b);if(merged.size)state.books=[...merged.values()];
    const mine=state.books.filter(b=>b.authorId===state.account.authorId);if(mine[0])state.marketingBookId=mine[0].id;if(libPayload?.items?.length)state.reader.library=libPayload.items.map(i=>({bookId:i.book_id,editionId:i.edition_id,format:formatLabel(i.format),percent:Number(i.percent||0),secondsPosition:i.seconds_position||null}));if(savedPayload?.books)state.reader.saved=savedPayload.books.map(b=>b.id);if(recentPayload?.books)state.reader.recent=recentPayload.books.map(b=>b.id);persistReader();
    state.api=true;render();
  }catch{}
}

const pathMatch=location.pathname.match(/(?:^|\/)book\/([^/]+)\/?$/);const q=new URLSearchParams(location.search);const slug=pathMatch?decodeURIComponent(pathMatch[1]):q.get('book'),authorQ=q.get('author'),seriesQ=q.get('series');if(authorQ){state.publicAuthorHandle=authorQ;state.view='authorpage'}else if(seriesQ){state.publicSeries=seriesQ;state.view='seriespage'}if(slug){const found=state.books.find(b=>b.slug===slug);if(found)state.selected=found;track('campaign_landing',{bookId:found?.id,bookSlug:slug,source:q.get('utm_source'),campaignId:q.get('yr_campaign')})}
render();hydrateFromApi();
