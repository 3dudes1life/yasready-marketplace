export function normalizeReaderProgress(input={}){
  const kind=String(input.progressKind||input.kind||'').toLowerCase();
  if(!['ebook','audiobook'].includes(kind)) throw new Error('progress_kind_invalid');
  const percent=Math.max(0,Math.min(100,Number(input.percent)||0));
  const seconds=kind==='audiobook'&&input.secondsPosition!=null?Math.max(0,Number(input.secondsPosition)||0):null;
  const locator=input.locator&&typeof input.locator==='object'?input.locator:null;
  return {progressKind:kind,percent:Number(percent.toFixed(2)),secondsPosition:seconds,locator,completed:percent>=99.5};
}
export function readerCanOpenEdition({format,status='active'}={}){
  return status==='active'&&['ebook','audiobook'].includes(String(format||'').toLowerCase());
}
export function groupSeries(books=[]){
  const groups=new Map();
  for(const b of books){if(!b.series)continue;const key=b.series;const x=groups.get(key)||{name:key,books:[]};x.books.push(b);groups.set(key,x)}
  return [...groups.values()].map(x=>({...x,books:x.books.sort((a,b)=>(Number(a.seriesNumber)||999)-(Number(b.seriesNumber)||999))}));
}
export function publicAuthorFromBooks(books=[],handle=''){
  const matches=books.filter(b=>b.handle===handle||b.author?.handle===handle);if(!matches.length)return null;
  const first=matches[0],a=first.author&&typeof first.author==='object'?first.author:{};
  return {id:first.authorId||a.id||null,handle:handle||first.handle||a.handle||null,name:first.authorName||(typeof first.author==='string'?first.author:null)||a.name||'YasReady Author',bio:a.bio||first.authorBio||null,websiteUrl:a.websiteUrl||null,storefrontTagline:a.storefrontTagline||null,books:matches};
}
