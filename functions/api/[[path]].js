const categories = new Set(['OBSERVATION', 'THOUGHT', 'DISCOVERY']);
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;

export async function onRequest({request, env}) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!env.DB) return json({error:'데이터베이스가 연결되지 않았습니다. Cloudflare에서 DB 바인딩을 설정해 주세요.'},503);
  try {
    if (request.method === 'GET' && path === '/api/posts') {
      const offset = Math.min(Math.max(Number.parseInt(url.searchParams.get('offset') || '0',10) || 0,0),1000000);
      const q = (url.searchParams.get('q') || '').trim().slice(0,100);
      const pattern = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
      const where = "WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\'";
      const rows = await env.DB.prepare(`SELECT id,title,body,author,category,created_at, (SELECT COUNT(*) FROM comments WHERE post_id=posts.id) AS comment_count FROM posts ${where} ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?`).bind(pattern,pattern,pattern,offset).all();
      const total = await env.DB.prepare(`SELECT COUNT(*) AS total FROM posts ${where}`).bind(pattern,pattern,pattern).first();
      return json({posts:rows.results.slice(0,20),hasMore:rows.results.length>20,total:total.total});
    }
    const match = path.match(/^\/api\/posts\/([a-f0-9-]{36})\/comments$/);
    if (request.method === 'GET' && match) {
      const exists = await env.DB.prepare('SELECT id FROM posts WHERE id=?').bind(match[1]).first();
      if (!exists) return json({error:'글을 찾을 수 없습니다.'},404);
      const result = await env.DB.prepare('SELECT id,author,body,created_at FROM comments WHERE post_id=? ORDER BY created_at,id LIMIT 200').bind(match[1]).all();
      return json({comments:result.results});
    }
    if (request.method !== 'POST') return json({error:'지원하지 않는 요청입니다.'},404);
    if (path !== '/api/posts' && !match) return json({error:'주소를 찾을 수 없습니다.'},404);
    if (request.headers.get('Origin') !== url.origin) return json({error:'허용되지 않은 요청입니다.'},403);
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return json({error:'JSON 요청이 필요합니다.'},415);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 20000) return json({error:'내용이 너무 깁니다.'},413);
    let data; try { data = JSON.parse(raw); } catch { return json({error:'올바르지 않은 요청입니다.'},400); }
    if (!data || typeof data !== 'object') return json({error:'올바르지 않은 요청입니다.'},400);
    const author = text(data.author,30), body = text(data.body,match ? 2000 : 10000);
    const title = text(data.title,100);
    if (!author || !body || (!match && (!title || !categories.has(data.category)))) return json({error:'닉네임과 내용을 확인해 주세요. 제목은 100자, 본문은 10,000자, 댓글은 2,000자까지입니다.'},400);
    if (match) {
      const exists = await env.DB.prepare('SELECT id FROM posts WHERE id=?').bind(match[1]).first();
      if (!exists) return json({error:'글을 찾을 수 없습니다.'},404);
    }
    // Atomic D1 gate: one write per IP every 15 seconds across posts and comments.
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return json({error:'요청 출처를 확인할 수 없습니다.'},403);
    const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url.hostname + ':' + ip));
    const key = Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
    const now = Date.now();
    const gate = await env.DB.prepare('INSERT INTO write_limits (key,last_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_at=excluded.last_at WHERE write_limits.last_at <= ? RETURNING key').bind(key,now,now-15000).first();
    if (!gate) return json({error:'잠시 후 다시 작성해 주세요. 작성 간격은 15초입니다.'},429);
    const id = crypto.randomUUID(), created_at = new Date().toISOString();
    if (match) await env.DB.prepare('INSERT INTO comments(id,post_id,author,body,created_at) VALUES (?,?,?,?,?)').bind(id,match[1],author,body,created_at).run();
    else await env.DB.prepare('INSERT INTO posts(id,title,body,author,category,created_at) VALUES (?,?,?,?,?,?)').bind(id,title,body,author,data.category,created_at).run();
    await env.DB.prepare('DELETE FROM write_limits WHERE last_at < ?').bind(now-86400000).run();
    return json({id,created_at},201);
  } catch (error) {
    console.error('Community database request failed',error.message);
    return json({error:'데이터베이스 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'},500);
  }
}
