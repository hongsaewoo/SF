import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { onRequest } from './functions/api/[[path]].js';
await mkdir(new URL('./.wrangler/', import.meta.url), {recursive:true});
const db = new DatabaseSync(new URL('./.wrangler/local.sqlite', import.meta.url).pathname);
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const name of (await readdir(new URL('./migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){
  if(db.prepare('SELECT name FROM local_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN');
  try{db.exec(await readFile(new URL('./migrations/'+name,import.meta.url),'utf8'));db.prepare('INSERT INTO local_migrations(name) VALUES (?)').run(name);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
}
const DB = {prepare(sql) { let args=[]; const stmt=db.prepare(sql); const api={bind(...values){args=values;return api},async all(){return {results:stmt.all(...args)}},async first(){return stmt.get(...args)??null},async run(){return stmt.run(...args)}};return api}};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost:8787');let response;if(url.pathname==='/api'||url.pathname.startsWith('/api/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers=new Headers(req.headers);headers.set('CF-Connecting-IP',req.socket.remoteAddress);response=await onRequest({request:new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),env:{DB}})}else{const files={'/':'index.html','/index.html':'index.html','/community.js':'community.js','/assets/coast-gray.jpg':'assets/coast-gray.jpg'};const file=files[url.pathname];response=file?new Response(await readFile(new URL('./'+file,import.meta.url)),{headers:{'Content-Type':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'}}):new Response('Not found',{status:404})}res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(error){console.error(error);res.writeHead(500);res.end('Local server error')}}).listen(8787,'127.0.0.1',()=>console.log('Local server: http://localhost:8787'));
