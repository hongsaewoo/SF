'use strict';
const $ = id => document.getElementById(id);
let posts = [], offset = 0, hasMore = false, selected = null, searchTimer, requestVersion = 0;
const statusLine = document.createElement('p'); statusLine.role = 'status'; statusLine.className = 'muted';
$('archive-list').before(statusLine);
const loadMore = document.createElement('button'); loadMore.textContent = '더 보기'; loadMore.hidden = true;
$('archive-list').after(loadMore);
const refresh = document.createElement('button'); refresh.textContent = '새로고침';
document.querySelector('.toolbar').append(refresh);
const authorLabel = document.createElement('label'); authorLabel.htmlFor = 'author'; authorLabel.textContent = '닉네임 (계정 인증 없음)';
const authorInput = document.createElement('input'); authorInput.id = 'author'; authorInput.required = true; authorInput.maxLength = 30; authorInput.placeholder = '표시할 이름';
$('record-form').prepend(authorLabel,authorInput);
const detail = document.createElement('section'); detail.className = 'page'; detail.id = 'detail'; detail.hidden = true;
document.querySelector('main').append(detail);
function element(tag,content,cls) { const el=document.createElement(tag); if(content!==undefined)el.textContent=content; if(cls)el.className=cls; return el; }
async function api(path, data) {
  const response = await fetch('/api' + path, data ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)} : {cache:'no-store'});
  let result; try { result = await response.json(); } catch { throw new Error('커뮤니티 서버에 연결할 수 없습니다. Pages Functions 배포 상태를 확인해 주세요.'); }
  if (!response.ok) throw new Error(result.error || '요청에 실패했습니다.');
  return result;
}
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.hidden = p.id !== name);
  document.querySelectorAll('nav button').forEach(b => { if(b.dataset.page===name)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  window.scrollTo({top:0});
}
document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click',()=>showPage(b.dataset.page)));
function card(post) {
  const article = element('article',undefined,'record');
  const heading = element('h3'); const open = element('button',post.title); open.style.textAlign='left'; open.addEventListener('click',()=>openPost(post)); heading.append(open);
  const footer = element('footer'); footer.append(element('span',post.author),element('span',post.created_at.slice(0,10)));
  article.append(element('span',post.category,'tag green'),heading,element('p',post.body.length>180?post.body.slice(0,180)+'…':post.body),element('span','댓글 '+post.comment_count,'tag muted'),footer); return article;
}
function render() {
  $('archive-list').replaceChildren(...posts.map(card));
  if(!posts.length)$('archive-list').append(element('p','아직 기록이 없습니다. 첫 번째 신호를 남겨 주세요.','empty'));
  loadMore.hidden=!hasMore;
}
async function load(append=false) {
  const version = ++requestVersion;
  loadMore.disabled=true; statusLine.textContent='기록을 불러오는 중…';
  try {
    const nextOffset=append?offset+20:0;
    const result=await api('/posts?q='+encodeURIComponent($('search').value.trim())+'&offset='+nextOffset);
    if(version!==requestVersion)return;
    posts=append?[...posts,...result.posts]:result.posts; offset=nextOffset; hasMore=result.hasMore;
    $('record-count').textContent=String(result.total).padStart(3,'0'); statusLine.textContent=result.total+'개의 공유 기록'; render();
    if(!$('search').value.trim() && !append)$('latest').replaceChildren(...posts.slice(0,3).map(card));
  } catch(error) { if(version===requestVersion){statusLine.textContent=error.message; if(!posts.length)$('latest').replaceChildren(element('p',error.message,'empty'));} }
  finally {if(version===requestVersion)loadMore.disabled=false;}
}
async function openPost(post) {
  selected=post.id; showPage('detail');
  const back=element('button','← 아카이브'); back.addEventListener('click',()=>showPage('archive'));
  const content=element('article',undefined,'panel'); const body=element('p',post.body);body.style.whiteSpace='pre-wrap';body.style.overflowWrap='anywhere';
  content.append(element('span',post.category,'tag green'),element('h2',post.title),element('p',post.author+' · '+post.created_at.slice(0,10),'muted'),body);
  const comments=element('div');const message=element('p','댓글 불러오는 중…','muted'); message.role='status';
  const form=element('form');const nameLabel=element('label','닉네임');nameLabel.htmlFor='comment-author';
  const name=element('input');name.id='comment-author';name.required=true;name.maxLength=30;name.value=authorInput.value;
  const bodyLabel=element('label','댓글');bodyLabel.htmlFor='comment-body';const input=element('textarea');input.id='comment-body';input.required=true;input.maxLength=2000;
  const send=element('button','댓글 등록','primary');send.type='submit';form.append(nameLabel,name,bodyLabel,input,send);
  detail.replaceChildren(back,content,element('h3','댓글 (최대 200개 표시)'),comments,message,form);
  async function reloadComments() {const result=await api('/posts/'+post.id+'/comments');if(selected!==post.id)return;comments.replaceChildren(...result.comments.map(c=>{const row=element('article',undefined,'record');row.append(element('span',c.author+' · '+c.created_at.slice(0,10),'tag green'),element('p',c.body));return row;}));message.textContent=result.comments.length?'':'첫 댓글을 남겨 주세요.';}
  form.addEventListener('submit',async event=>{event.preventDefault();send.disabled=true;try{await api('/posts/'+post.id+'/comments',{author:name.value.trim(),body:input.value.trim()});input.value='';message.textContent='댓글이 저장됐습니다.';try{await reloadComments();}catch{message.textContent='댓글은 저장됐습니다. 목록을 다시 열어 확인해 주세요.';}load();}catch(error){message.textContent=error.message;}finally{send.disabled=false;}});
  try{await reloadComments();}catch(error){message.textContent=error.message;}
}
$('record-form').addEventListener('submit',async event=>{
  event.preventDefault();const send=event.target.querySelector('button[type=submit]');send.disabled=true;$('notice').textContent='공유 기록을 저장하는 중…';
  try {await api('/posts',{title:$('title').value.trim(),body:$('body').value.trim(),category:$('category').value,author:authorInput.value.trim()});$('title').value='';$('body').value='';$('notice').textContent='공유 기록을 저장했습니다.';$('search').value='';await load();showPage('archive');}
  catch(error){$('notice').textContent=error.message;}finally{send.disabled=false;}
});
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),300);});
refresh.addEventListener('click',()=>load());loadMore.addEventListener('click',()=>load(true));
function tick(){$('clock').textContent=new Date().toISOString().slice(11,19)+' UTC';}
tick();setInterval(tick,1000);load();
