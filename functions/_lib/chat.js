import {currentUser} from './auth.js';

export async function chatRoute(request, DB, data, json) {
  if (request.method==='GET') {
    const url=new URL(request.url);
    const after=url.searchParams.get('after');
    if(after!==null&&(!/^\d{1,16}$/.test(after)||!Number.isSafeInteger(Number(after))))return json({error:'잘못된 메시지 위치입니다.'},400);
    const cursor=Number(after||0);
    const result=after===null
      ? await DB.prepare('SELECT id,user_id,author,body,created_at FROM chat_messages ORDER BY id DESC LIMIT 50').all()
      : await DB.prepare('SELECT id,user_id,author,body,created_at FROM chat_messages WHERE id>? ORDER BY id LIMIT 51').bind(cursor).all();
    const messages=after===null?result.results.reverse():result.results.slice(0,50);
    return json({messages,cursor:messages.at(-1)?.id??cursor,hasMore:after!==null&&result.results.length>50});
  }
  const user=await currentUser(request,DB);
  if(!user)return json({error:'채팅을 보내려면 로그인해 주세요.'},401);
  const body=typeof data.body==='string'?data.body.trim():'';
  const clientId=typeof data.client_id==='string'?data.client_id:'';
  if(!body||body.length>500)return json({error:'메시지는 1~500자로 입력해 주세요.'},400);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clientId))return json({error:'잘못된 메시지 요청입니다.'},400);
  const existing=await DB.prepare('SELECT id,user_id,author,body,created_at FROM chat_messages WHERE user_id=? AND client_id=?').bind(user.id,clientId).first();
  if(existing){
    if(existing.body!==body)return json({error:'이미 전송된 메시지입니다. 새 메시지로 다시 보내 주세요.'},409);
    return json({message:existing});
  }
  const now=Date.now();
  const allowed=await DB.prepare('INSERT INTO write_limits (key,last_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_at=excluded.last_at WHERE write_limits.last_at<=? RETURNING key').bind('chat:'+user.id,now,now-2000).first();
  if(!allowed)return json({error:'메시지는 2초 간격으로 보낼 수 있습니다.'},429);
  const createdAt=new Date(now).toISOString();
  const message=await DB.prepare('INSERT INTO chat_messages(user_id,author,body,client_id,created_at) VALUES (?,?,?,?,?) RETURNING id,user_id,author,body,created_at').bind(user.id,user.nickname,body,clientId,createdAt).first();
  return json({message},201);
}
