'use strict';
// One shared channel, independent of the page currently open inside #app.
(() => {
  const get=id=>document.getElementById(id);
  const panel=get('chat-panel'), toggle=get('chat-toggle'), log=get('chat-log');
  const input=get('chat-input'), send=get('chat-send'), feedback=get('chat-status');
  let opened=false, loaded=false, cursor=0, timer, reading=null, sending=false, pending=null;
  let previousUser=observer?.id??null;
  const rows=new Map();
  const active=()=>opened&&!document.hidden&&!get('app').hidden;
  function status(text,kind='send'){feedback.textContent=text;feedback.dataset.kind=kind;}
  function scrollLatest(){log.scrollTop=log.scrollHeight;get('chat-new').hidden=true;}
  function syncIdentity(){
    const userId=observer?.id??null;
    if(previousUser!==userId){input.value='';pending=null;get('chat-count').textContent='0 / 500';}
    previousUser=userId;
    get('chat-guest').hidden=!!observer;get('chat-form').hidden=!observer;
    send.disabled=sending||!observer;
    for(const row of rows.values())row.classList.toggle('chat-own',row.dataset.userId===userId);
  }
  function insert(messages,forceScroll=false){
    const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<80;
    let added=0;
    for(const message of messages){
      if(rows.has(message.id))continue;
      get('chat-empty').hidden=true;
      const row=document.createElement('article');row.className='chat-message';
      row.dataset.messageId=String(message.id);row.dataset.userId=message.user_id;
      row.classList.toggle('chat-own',message.user_id===observer?.id);
      const meta=document.createElement('div');meta.className='chat-message-meta';
      const author=document.createElement('strong');author.textContent=message.author;
      const time=document.createElement('time');time.dateTime=message.created_at;
      time.textContent=new Date(message.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
      time.title=new Date(message.created_at).toLocaleString('ko-KR');
      const text=document.createElement('p');text.textContent=message.body;
      meta.append(author,time);row.append(meta,text);
      const next=Array.from(log.children).find(child=>Number(child.dataset.messageId)>message.id);
      log.insertBefore(row,next||null);rows.set(message.id,row);added++;
    }
    while(rows.size>200){
      const oldest=Math.min(...rows.keys());rows.get(oldest).remove();rows.delete(oldest);
    }
    if(added){if(nearBottom||forceScroll)scrollLatest();else get('chat-new').hidden=false;}
  }
  async function refresh(){
    if(!active()||reading)return;
    const initial=!loaded;
    reading=(async()=>{
      try{
        const result=await api('/chat/messages'+(loaded?'?after='+cursor:''));
        if(initial)log.setAttribute('aria-live','off');
        insert(result.messages,initial);
        cursor=result.cursor;loaded=true;
        if(!rows.size){get('chat-empty').textContent='아직 대화가 없습니다. 첫 인사를 남겨보세요.';get('chat-empty').hidden=false;}
        get('chat-connection').textContent='연결됨';get('chat-connection').dataset.state='online';
        get('chat-retry').hidden=true;
        if(feedback.dataset.kind==='connection')status('');
        if(result.hasMore&&active())timer=setTimeout(()=>{timer=null;refresh();},100);
      }catch(error){
        get('chat-connection').textContent='연결 지연';get('chat-connection').dataset.state='offline';
        status(error.message,'connection');get('chat-retry').hidden=false;
        if(!loaded)get('chat-empty').textContent='대화를 불러오지 못했습니다.';
      }finally{
        reading=null;
        if(active()){
          log.setAttribute('aria-live','polite');
          if(!timer)timer=setTimeout(()=>{timer=null;refresh();},5000);
        }
      }
    })();
    await reading;
  }
  function open(){
    if(get('app').hidden)return;
    opened=true;panel.hidden=false;toggle.setAttribute('aria-expanded','true');
    toggle.querySelector('.chat-toggle-arrow').textContent='⌄';
    syncIdentity();refresh();
    if(observer)input.focus();else log.focus();
  }
  function close(){
    opened=false;panel.hidden=true;toggle.setAttribute('aria-expanded','false');
    toggle.querySelector('.chat-toggle-arrow').textContent='⌃';
    clearTimeout(timer);timer=null;log.setAttribute('aria-live','off');toggle.focus();
  }
  toggle.addEventListener('click',()=>opened?close():open());
  get('chat-close').addEventListener('click',close);
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();close();}});
  get('chat-login').addEventListener('click',()=>openAuth('login'));
  get('chat-new').addEventListener('click',scrollLatest);
  log.addEventListener('scroll',()=>{if(log.scrollHeight-log.scrollTop-log.clientHeight<80)get('chat-new').hidden=true;});
  input.addEventListener('input',()=>{get('chat-count').textContent=input.value.length+' / 500';});
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();if(!sending)get('chat-form').requestSubmit();}
  });
  get('chat-form').addEventListener('submit',async event=>{
    event.preventDefault();if(sending)return;
    if(!observer){openAuth('login');return;}
    const text=input.value.trim();if(!text){input.focus();return;}
    if(!pending||pending.body!==text)pending={body:text,client_id:crypto.randomUUID()};
    const payload=pending, sentAs=observer.id;
    sending=true;send.disabled=true;status('전송 중…');
    try{
      const result=await api('/chat/messages',payload);
      insert([result.message],true);
      // Poll cursors advance only from GET, so messages sent by others cannot be skipped.
      if(observer?.id===sentAs&&input.value.trim()===text){input.value='';get('chat-count').textContent='0 / 500';pending=null;}
      status('');
      clearTimeout(timer);timer=null;refresh();
    }catch(error){status(error.message);}
    finally{sending=false;send.disabled=!observer;}
  });
  get('chat-retry').addEventListener('click',()=>{clearTimeout(timer);timer=null;refresh();});
  document.addEventListener('visibilitychange',()=>{
    clearTimeout(timer);timer=null;
    if(active())refresh();else log.setAttribute('aria-live','off');
  });
  window.addEventListener('observerchange',syncIdentity);
  syncIdentity();
})();
