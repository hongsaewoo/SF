const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), v => v.toString(16).padStart(2, '0')).join('');
const unhex = value => Uint8Array.from(value.match(/../g), v => parseInt(v,16));
const random = length => hex(crypto.getRandomValues(new Uint8Array(length)));
export const digest = async value => hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
// Workers-compatible Web Crypto; per-user salt and work factor are stored for upgrades.
const ITERATIONS = 100000;
async function passwordHash(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations,hash:'SHA-256'},key,256));
}
async function verifyPassword(password, user) {
  const value = await passwordHash(password,user.salt,user.iterations);
  // HMAC verification avoids comparing password-derived bytes in application code.
  const key = await crypto.subtle.importKey('raw',unhex(value),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const verifier = await crypto.subtle.importKey('raw',unhex(user.password_hash),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const message = encoder.encode('NULL/VECTOR password check');
  return crypto.subtle.verify('HMAC',verifier,await crypto.subtle.sign('HMAC',key,message),message);
}
function cookieToken(request) {
  const name = new URL(request.url).protocol === 'https:' ? '__Host-nv_session' : 'nv_session';
  const value = (request.headers.get('Cookie') || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
function sessionCookie(request, token, maxAge=604800) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${secure ? '__Host-nv_session' : 'nv_session'}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
export async function currentUser(request, DB) {
  const token = cookieToken(request);
  if (!token) return null;
  return await DB.prepare('SELECT users.id,username,nickname,created_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first();
}
async function session(request, DB, user, json, status=200) {
  const previous = cookieToken(request);
  if (previous) await DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(previous)).run();
  const token = random(32);
  await DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token),user.id,Date.now()+604800000).run();
  await DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()).run();
  const response = json({user:{id:user.id,username:user.username,nickname:user.nickname,created_at:user.created_at}},status);
  response.headers.set('Set-Cookie',sessionCookie(request,token));
  return response;
}
async function limited(DB,key,max,windowMs) {
  const now=Date.now();
  const row=await DB.prepare('INSERT INTO auth_limits(key,attempts,resets_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resets_at<=? THEN 1 ELSE attempts+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END RETURNING attempts').bind(key,now+windowMs,now,now).first();
  await DB.prepare('DELETE FROM auth_limits WHERE resets_at<=?').bind(now).run();
  return row.attempts>max;
}
export async function authRoute(request, DB, path, data, json) {
  if (path==='/api/auth/me') return json({user:await currentUser(request,DB)});
  if (path==='/api/auth/logout') {
    const token=cookieToken(request);
    if(token)await DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
    const response=json({ok:true});response.headers.set('Set-Cookie',sessionCookie(request,'',0));return response;
  }
  const username=typeof data.username==='string'?data.username.trim().toLowerCase():'';
  const password=data.password;
  if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof password!=='string'||password.length<10||password.length>128) return json({error:'아이디는 영문 소문자·숫자·밑줄 3~24자, 비밀번호는 10~128자로 입력해 주세요.'},400);
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip)return json({error:'요청 출처를 확인할 수 없습니다.'},403);
  const ipKey=await digest(new URL(request.url).hostname+':'+ip);
  if(await limited(DB,'ip:'+path+':'+ipKey,path.endsWith('signup')?5:20,path.endsWith('signup')?3600000:600000))return json({error:'시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'},429);
  if(path==='/api/auth/signup') {
    const nickname=typeof data.nickname==='string'?data.nickname.trim():'';
    if(!nickname||nickname.length>30)return json({error:'닉네임은 1~30자로 입력해 주세요.'},400);
    const salt=random(16),id=crypto.randomUUID(),created_at=new Date().toISOString();
    const hash=await passwordHash(password,salt,ITERATIONS);
    const inserted=await DB.prepare('INSERT INTO users(id,username,nickname,password_hash,salt,iterations,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id').bind(id,username,nickname,hash,salt,ITERATIONS,created_at).first();
    if(!inserted)return json({error:'이미 사용 중인 아이디 또는 닉네임입니다.'},409);
    return session(request,DB,{id,username,nickname,created_at},json,201);
  }
  const accountKey='account:'+await digest(username);
  if(await limited(DB,accountKey,10,600000))return json({error:'로그인 시도가 너무 많습니다. 10분 후 다시 시도해 주세요.'},429);
  const user=await DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  const valid=await verifyPassword(password,user||{salt:'00000000000000000000000000000000',iterations:ITERATIONS,password_hash:'0'.repeat(64)});
  if(!user||!valid)return json({error:'아이디 또는 비밀번호를 확인해 주세요.'},401);
  return session(request,DB,user,json);
}
