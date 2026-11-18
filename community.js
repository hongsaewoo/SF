'use strict';
const $ = id => document.getElementById(id);
let posts = [], offset = 0, hasMore = false, selected = null, searchTimer, requestVersion = 0;
const statusLine = document.createElement('p'); statusLine.role = 'status'; statusLine.className = 'muted';
$('archive-list').before(statusLine);
const loadMore = document.createElement('button'); loadMore.textContent = '더 보기'; loadMore.hidden = true;
$('archive-list').after(loadMore);
const refresh = document.createElement('button'); refresh.textContent = '새로고침';
document.querySelector('.toolbar').append(refresh);
let observer = null, authMode = 'signup', onlyMine = false;
const authorInput = document.createElement('input'); authorInput.id='author'; authorInput.type='hidden';
const byline = element('p','로그인 후 기록을 남길 수 있습니다.','account-byline');
const writeLogin = element('button','로그인하기'); writeLogin.type='button';writeLogin.addEventListener('click',()=>openAuth('login'));
const writePrompt = element('div',undefined,'auth-inline');writePrompt.append(element('span','나만의 발견을 기록하려면 로그인해 주세요.'),writeLogin);
$('record-form').prepend(byline,authorInput);$('record-form').before(writePrompt);
const authDialog=$('auth-dialog');
function openAuth(mode='signup') {
  if(authDialog.querySelector('button[type=submit]').disabled)return;
  authMode=mode;
  const signup=mode==='signup';
  $('auth-heading').textContent=signup?'관측자가 되어보세요.':'다시 오셨군요.';
  $('auth-description').textContent=signup?'계정을 만들고 발견을 기록하세요.':'로그인하고 관측을 이어가세요.';
  $('auth-nickname-field').hidden=!signup;$('auth-nickname').disabled=!signup;
  $('auth-confirm-field').hidden=!signup;$('auth-confirm').disabled=!signup;
  $('auth-password').autocomplete=signup?'new-password':'current-password';
  $('auth-send').textContent=signup?'계정 만들기 ↗':'로그인 →';
  $('auth-message').textContent='';$('auth-password').value='';$('auth-confirm').value='';
  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authTab===mode)));
  if(!authDialog.open)authDialog.showModal();
  $('auth-username').focus();
}
function syncObserver() {
  $('guest-actions').hidden=!!observer;$('member-actions').hidden=!observer;
  $('observer-avatar').textContent=observer?Array.from(observer.nickname).slice(0,2).join(''):'N/V';
  $('observer-role').textContent=observer?'REGISTERED OBSERVER':'GUEST OBSERVER';
  $('observer-name').textContent=observer?observer.nickname:'Welcome, stranger.';
  $('observer-description').textContent=observer?'오늘은 무엇을 발견하셨나요?':'관측을 시작하고 나만의 기록을 남겨보세요.';
  $('session-status').textContent=observer?'SIGNED IN':'GUEST';
  authorInput.value=observer?.nickname||'';
  byline.textContent=observer?observer.nickname+' 님의 기록으로 공개됩니다.':'로그인 후 기록을 남길 수 있습니다.';
  writePrompt.hidden=!!observer;
  $('record-form').querySelector('button[type=submit]').disabled=!observer;
}
document.querySelectorAll('[data-auth]').forEach(b=>b.addEventListener('click',()=>openAuth(b.dataset.auth)));
document.querySelectorAll('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>openAuth(b.dataset.authTab)));
$('auth-close').addEventListener('click',()=>authDialog.close());
$('auth-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(authMode==='signup'&&$('auth-password').value!==$('auth-confirm').value){$('auth-message').textContent='비밀번호가 서로 다릅니다.';return;}
  $('auth-send').disabled=true;$('auth-message').textContent='계정을 확인하고 있습니다…';
  try {
    const result=await api('/auth/'+authMode,{username:$('auth-username').value,nickname:$('auth-nickname').value,password:$('auth-password').value});
    observer=result.user;syncObserver();authDialog.close();$('auth-form').reset();
    if(selected&& !detail.hidden){const post=posts.find(p=>p.id===selected);if(post)openPost(post);}
    await updateStatus();
  }catch(error){$('auth-message').textContent=error.message;}
  finally{$('auth-send').disabled=false;}
});
$('logout').addEventListener('click',async()=>{
  $('logout').disabled=true;
  try{await api('/auth/logout',{});observer=null;syncObserver();onlyMine=false;showPage('dashboard');await load();await updateStatus();}
  catch(error){$('status-updated').textContent=error.message;}
  finally{$('logout').disabled=false;}
});
document.querySelectorAll('[data-mine]').forEach(b=>b.addEventListener('click',()=>{
  if(!observer){openAuth('login');return;}
  onlyMine=true;showPage('archive',true);load();
}));
async function updateStatus() {
  try{
    const result=await api('/status');
    if(observer?.id!==result.user?.id){observer=result.user;syncObserver();}
    $('network-status').textContent='ONLINE';$('network-status').style.color='';
    $('network-detail').textContent='아카이브에 연결되어 있습니다.';
    $('record-count').textContent=String(result.total).padStart(3,'0');
    $('my-record-count').textContent=observer?String(result.mine).padStart(3,'0'):'—';
    $('status-updated').textContent='UPDATED / '+new Date().toLocaleTimeString('ko-KR',{hour12:false});
  }catch(error){$('network-status').textContent='OFFLINE';$('network-status').style.color='#d8a18c';$('network-detail').textContent=error.message;$('status-updated').textContent='연결을 다시 확인해 주세요.';}
}
async function restoreObserver(){
  try{observer=(await api('/auth/me')).user;}
  catch(error){$('status-updated').textContent=error.message;}
  syncObserver();await updateStatus();
}
const detail = document.createElement('section'); detail.className = 'page'; detail.id = 'detail'; detail.hidden = true;
document.querySelector('main').append(detail);
function element(tag,content,cls) { const el=document.createElement(tag); if(content!==undefined)el.textContent=content; if(cls)el.className=cls; return el; }
async function api(path, data) {
  const response = await fetch('/api' + path, data ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)} : {cache:'no-store'});
  let result; try { result = await response.json(); } catch { throw new Error('커뮤니티 서버에 연결할 수 없습니다. Pages Functions 배포 상태를 확인해 주세요.'); }
  if (!response.ok) {if(response.status===401&&!path.startsWith('/auth/')){observer=null;syncObserver();openAuth('login');}const error=new Error(result.error || '요청에 실패했습니다.');error.status=response.status;throw error;}
  return result;
}
function showPage(name, mine=false) {
  if(name==='archive'){onlyMine=mine;$('archive-heading').textContent=mine?'나의 관측 기록.':'사라지기 전에, 기록.';}
  document.querySelectorAll('.page').forEach(p => p.hidden = p.id !== name);
  document.querySelectorAll('nav button').forEach(b => { if(b.dataset.page===name)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  window.scrollTo({top:0});
}
document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click',()=>{showPage(b.dataset.page);if(b.dataset.page==='archive')load();}));
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
    const result=await api('/posts?q='+encodeURIComponent($('search').value.trim())+'&offset='+nextOffset+(onlyMine?'&mine=1':''));
    if(version!==requestVersion)return;
    posts=append?[...posts,...result.posts]:result.posts; offset=nextOffset; hasMore=result.hasMore;
    statusLine.textContent=result.total+(onlyMine?'개의 내 기록':'개의 공유 기록'); render();
    if(!$('search').value.trim() && !append && !onlyMine)$('latest').replaceChildren(...(posts.length?posts.slice(0,3).map(card):[element('p','아직 도착한 기록이 없습니다. 첫 관측을 남겨보세요.','empty')]));
  } catch(error) { if(version===requestVersion){statusLine.textContent=error.message; if(!posts.length)$('latest').replaceChildren(element('p',error.message,'empty'));} }
  finally {if(version===requestVersion)loadMore.disabled=false;}
}
async function openPost(post) {
  selected=post.id; showPage('detail');
  const back=element('button','← 아카이브'); back.addEventListener('click',()=>{showPage('archive',onlyMine);load();});
  const content=element('article',undefined,'panel'); const body=element('p',post.body);body.style.whiteSpace='pre-wrap';body.style.overflowWrap='anywhere';
  content.append(element('span',post.category,'tag green'),element('h2',post.title),element('p',post.author+' · '+post.created_at.slice(0,10),'muted'),body);
  const comments=element('div');const message=element('p','댓글 불러오는 중…','muted'); message.role='status';
  const form=element('form');const nameLabel=element('label','작성자');nameLabel.htmlFor='comment-author';
  const name=element('input');name.id='comment-author';name.required=true;name.maxLength=30;name.value=authorInput.value;name.readOnly=true;
  const bodyLabel=element('label','댓글');bodyLabel.htmlFor='comment-body';const input=element('textarea');input.id='comment-body';input.required=true;input.maxLength=2000;
  const send=element('button','댓글 등록','primary');send.type='submit';send.disabled=!observer;
  if(!observer){const login=element('button','로그인하고 댓글 쓰기');login.type='button';login.addEventListener('click',()=>openAuth('login'));form.append(login);}form.append(nameLabel,name,bodyLabel,input,send);
  detail.replaceChildren(back,content,element('h3','댓글 (최대 200개 표시)'),comments,message,form);
  async function reloadComments() {const result=await api('/posts/'+post.id+'/comments');if(selected!==post.id)return;comments.replaceChildren(...result.comments.map(c=>{const row=element('article',undefined,'record');row.append(element('span',c.author+' · '+c.created_at.slice(0,10),'tag green'),element('p',c.body));return row;}));message.textContent=result.comments.length?'':'첫 댓글을 남겨 주세요.';}
  form.addEventListener('submit',async event=>{event.preventDefault();if(!observer){openAuth('login');return;}send.disabled=true;try{await api('/posts/'+post.id+'/comments',{author:name.value.trim(),body:input.value.trim()});input.value='';message.textContent='댓글이 저장됐습니다.';try{await reloadComments();}catch{message.textContent='댓글은 저장됐습니다. 목록을 다시 열어 확인해 주세요.';}load();updateStatus();}catch(error){message.textContent=error.message;}finally{send.disabled=!observer;}});
  try{await reloadComments();}catch(error){message.textContent=error.message;}
}
$('record-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!observer){openAuth('login');return;}const send=event.target.querySelector('button[type=submit]');send.disabled=true;$('notice').textContent='공유 기록을 저장하는 중…';
  try {await api('/posts',{title:$('title').value.trim(),body:$('body').value.trim(),category:$('category').value,author:authorInput.value.trim()});$('title').value='';$('body').value='';$('notice').textContent='공유 기록을 저장했습니다.';$('search').value='';showPage('archive');await load();await updateStatus();}
  catch(error){$('notice').textContent=error.message;}finally{send.disabled=!observer;}
});
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),300);});
refresh.addEventListener('click',()=>load());loadMore.addEventListener('click',()=>load(true));
function tick(){$('clock').textContent=new Date().toISOString().slice(11,19)+' UTC';}
tick();setInterval(tick,1000);restoreObserver();load();
setInterval(()=>{if(!document.hidden&&!$('app').hidden)updateStatus();},30000);
