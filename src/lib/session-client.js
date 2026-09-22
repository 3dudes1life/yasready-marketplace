// Central YasReady identity adapter.
// Production should expose the same account SDK used by Publishing as:
// window.YasReadyIdentity.getAccessToken() -> Promise<string>
export async function getYasReadyAccessToken(){
  try{
    const provider=window.YasReadyIdentity;
    if(provider?.getAccessToken) return await provider.getAccessToken();
  }catch{}
  return null;
}
export async function authFetch(input,init={}){
  const token=await getYasReadyAccessToken();
  const headers=new Headers(init.headers||{});
  if(token) headers.set('authorization',`Bearer ${token}`);
  return fetch(input,{...init,headers});
}
