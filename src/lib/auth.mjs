const jwksCache = new Map();

function b64urlDecode(input='') {
  const s = input.replace(/-/g,'+').replace(/_/g,'/');
  const pad = s + '='.repeat((4 - (s.length % 4 || 4)) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}
function decodeJson(part){
  return JSON.parse(new TextDecoder().decode(b64urlDecode(part)));
}
function audMatches(actual, expected){
  if(!expected) return true;
  const values = Array.isArray(actual) ? actual : [actual];
  return values.includes(expected);
}
async function loadJwks(url){
  const cached=jwksCache.get(url);
  if(cached && cached.expiresAt>Date.now()) return cached.keys;
  const res=await fetch(url,{headers:{accept:'application/json'}});
  if(!res.ok) throw new Error(`jwks_fetch_${res.status}`);
  const body=await res.json();
  const keys=Array.isArray(body.keys)?body.keys:[];
  jwksCache.set(url,{keys,expiresAt:Date.now()+5*60_000});
  return keys;
}
async function verifyRs256(signingInput, signature, jwk){
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,new TextEncoder().encode(signingInput));
}

export async function verifyOidcJwt(token, env){
  if(!token) throw new Error('missing_token');
  const [h,p,s]=token.split('.');
  if(!h||!p||!s) throw new Error('malformed_token');
  const header=decodeJson(h), claims=decodeJson(p);
  if(header.alg!=='RS256') throw new Error('unsupported_alg');
  if(!env.YASREADY_JWKS_URL) throw new Error('missing_jwks_url');
  const keys=await loadJwks(env.YASREADY_JWKS_URL);
  const jwk=keys.find(k=>k.kid===header.kid && (k.use==='sig'||!k.use));
  if(!jwk) throw new Error('unknown_signing_key');
  const valid=await verifyRs256(`${h}.${p}`,b64urlDecode(s),jwk);
  if(!valid) throw new Error('invalid_signature');
  const now=Math.floor(Date.now()/1000);
  if(claims.exp && claims.exp < now-30) throw new Error('token_expired');
  if(claims.nbf && claims.nbf > now+30) throw new Error('token_not_active');
  if(env.YASREADY_AUTH_ISSUER && claims.iss!==env.YASREADY_AUTH_ISSUER) throw new Error('issuer_mismatch');
  if(!audMatches(claims.aud,env.YASREADY_AUTH_AUDIENCE)) throw new Error('audience_mismatch');
  if(!claims.sub) throw new Error('missing_subject');
  return {
    userId:String(claims.sub),
    email:claims.email||null,
    name:claims.name||claims.preferred_username||claims.email||'YasReady Author',
    avatarUrl:claims.picture||null,
    claims
  };
}

export async function getIdentity(request, env){
  const mode=env.YASREADY_AUTH_MODE||'demo';
  if(mode==='demo'){
    return {
      userId:env.DEMO_USER_ID||'demo-user-william',
      email:env.DEMO_USER_EMAIL||'demo@yasready.local',
      name:env.DEMO_USER_NAME||'William T. Zakrajshek',
      avatarUrl:null,
      claims:{demo:true}
    };
  }
  if(mode!=='oidc') throw new Error('unsupported_auth_mode');
  const auth=request.headers.get('authorization')||'';
  const m=auth.match(/^Bearer\s+(.+)$/i);
  if(!m) throw new Error('missing_bearer_token');
  return verifyOidcJwt(m[1],env);
}

export function publicIdentity(identity){
  return {userId:identity.userId,email:identity.email,name:identity.name,avatarUrl:identity.avatarUrl};
}
