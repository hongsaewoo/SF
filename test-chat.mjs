import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {onRequest} from './functions/api/[[path]].js';
const db=new DatabaseSync(':memory:');
for(const name of ['0001_community.sql','0002_accounts.sql','0003_chat.sql'])db.exec(readFileSync('migrations/'+name,'utf8'));
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){return db.prepare(sql).run(...values);}};}};
async function call(path,data,cookie='',extra={}){
 return onRequest({request:new Request('https://test.example/api'+path,{method:data?'POST':'GET',headers:{Origin:'https://test.example','Content-Type':'application/json','CF-Connecting-IP':'same-ip',Cookie:cookie,...extra},...(data?{body:JSON.stringify(data)}:{})}),env:{DB}});
}
async function account(username,nickname){const response=await call('/auth/signup',{username,nickname,password:'a-test-password-long'});assert.equal(response.status,201);return {user:(await response.json()).user,cookie:response.headers.get('set-cookie').split(';')[0]};}
const a=await account('chat_one','관측자 A'), b=await account('chat_two','관측자 B');
assert.deepEqual((await (await call('/chat/messages')).json()).messages,[]);
const payload={body:'  첫 인사 <script>alert(1)</script>  ',client_id:crypto.randomUUID(),author:'위조 이름'};
assert.equal((await call('/chat/messages',payload)).status,401);
assert.equal((await call('/chat/messages',payload,a.cookie,{Origin:'https://evil.example'})).status,403);
for(const body of ['', ' '.repeat(8), 'x'.repeat(501)])assert.equal((await call('/chat/messages',{...payload,body},a.cookie)).status,400);
assert.equal((await call('/chat/messages',{...payload,client_id:'bad'},a.cookie)).status,400);
const sent=await call('/chat/messages',payload,a.cookie);assert.equal(sent.status,201);const first=(await sent.json()).message;
assert.equal(first.author,a.user.nickname);assert.equal(first.user_id,a.user.id);assert.equal(first.body,payload.body.trim());
assert.equal(first.password_hash,undefined);assert.equal(first.client_id,undefined);
const retry=await call('/chat/messages',payload,a.cookie);assert.equal(retry.status,200);assert.equal((await retry.json()).message.id,first.id);
assert.equal((await call('/chat/messages',{...payload,body:'변경한 메시지'},a.cookie)).status,409);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chat_messages').get().n,1);
assert.equal((await call('/chat/messages',{body:'너무 빠른 전송',client_id:crypto.randomUUID()},a.cookie)).status,429);
const reply=await call('/chat/messages',{body:'다른 사용자 응답',client_id:crypto.randomUUID()},b.cookie);assert.equal(reply.status,201);
const shared=(await (await call('/chat/messages',undefined,b.cookie)).json()).messages;assert.equal(shared.length,2);assert.equal(shared[0].author,a.user.nickname);assert.equal(shared[1].author,b.user.nickname);
for(let i=0;i<115;i++)db.prepare('INSERT INTO chat_messages(user_id,author,body,client_id,created_at) VALUES (?,?,?,?,?)').run(a.user.id,a.user.nickname,'history '+i,crypto.randomUUID(),'2026-11-20T00:00:00Z');
const initial=await (await call('/chat/messages')).json();assert.equal(initial.messages.length,50);assert.equal(initial.cursor,117);assert.equal(initial.messages[0].id,68);
let cursor=0, all=[];
for(let page=0;page<3;page++){const result=await (await call('/chat/messages?after='+cursor)).json();assert.equal(result.hasMore,page<2);all.push(...result.messages);cursor=result.cursor;}
assert.equal(all.length,117);assert.equal(new Set(all.map(m=>m.id)).size,117);assert.equal(cursor,117);
assert.deepEqual((await (await call('/chat/messages?after=117')).json()).messages,[]);
for(const after of ['-1','NaN','9007199254740992','1%20OR%201=1'])assert.equal((await call('/chat/messages?after='+after)).status,400);
// Chat has its own throttle, so sending a message does not consume the post limit.
assert.equal((await call('/posts',{title:'Post after chat',body:'Body',category:'THOUGHT'},a.cookie)).status,201);
await call('/auth/logout',{},a.cookie);
assert.equal((await call('/chat/messages',{body:'after logout',client_id:crypto.randomUUID()},a.cookie)).status,401);
assert.equal((await call('/chat/messages',undefined,a.cookie)).status,200);
db.close();console.log('PASS: shared history, account-bound authors, guest read/send rules, CSRF, length checks, independent throttling, duplicate retries, incremental pagination and logout.');
