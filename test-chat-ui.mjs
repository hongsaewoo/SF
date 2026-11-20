import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
class Element {
  constructor(id){this.id=id;this.children=[];this.style={};this.dataset={};this.attributes={};this.events={};this.value='';this.hidden=false;this.textContent='';this.scrollTop=0;this.clientHeight=100;this.classes=new Set();this.classList={toggle:(key,value)=>{if(value)this.classes.add(key);else this.classes.delete(key);}};}
  get scrollHeight(){return this.children.length*60;}
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
  insertBefore(item,next){item.parent=this;const index=this.children.indexOf(next);if(index<0)this.children.push(item);else this.children.splice(index,0,item);}
  remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(key,fn){this.events[key]=fn;}
  querySelector(){return get('arrow');}
  focus(){this.focused=true;}
}
const nodes=new Map();
function get(id){if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);}
get('app').hidden=true;get('chat-panel').hidden=true;get('chat-log').append(get('chat-empty'));get('chat-new').hidden=true;
const windowEvents={},documentEvents={},timers=new Map(),messages=[],requests=[];
let nextTimer=0,dropResponse=false;
const context={document:{getElementById:get,hidden:false,addEventListener(key,fn){documentEvents[key]=fn;},createElement:tag=>new Element(tag)},window:{addEventListener(key,fn){windowEvents[key]=fn;}},observer:null,crypto,openAuth(){},setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},async api(path,payload){
  requests.push({path,payload});
  if(payload){
    let message=messages.find(m=>m.client_id===payload.client_id);
    if(!message){message={id:messages.length+1,client_id:payload.client_id,user_id:context.observer.id,author:context.observer.nickname,body:payload.body,created_at:'2026-11-20T00:00:00Z'};messages.push(message);}
    if(dropResponse){dropResponse=false;throw new Error('response lost');}
    return {message};
  }
  const after=path.includes('after=')?Number(path.split('after=')[1]):null;
  const matching=after===null?messages.slice(-50):messages.filter(m=>m.id>after);
  const page=matching.slice(0,50);return {messages:page,cursor:page.at(-1)?.id??after??0,hasMore:after!==null&&matching.length>50};
}};
vm.runInNewContext(readFileSync('chat.js','utf8'),context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
assert.equal(requests.length,0);
get('chat-toggle').events.click();assert.equal(requests.length,0);assert.equal(get('chat-panel').hidden,true);
get('app').hidden=false;get('chat-toggle').events.click();await flush();
assert.equal(get('chat-panel').hidden,false);assert.equal(get('chat-toggle').attributes['aria-expanded'],'true');assert.equal(get('chat-guest').hidden,false);
context.observer={id:'one',nickname:'관측자'};windowEvents.observerchange();assert.equal(get('chat-form').hidden,false);
get('chat-input').value='<img src=x onerror=alert(1)>';dropResponse=true;
await get('chat-form').events.submit({preventDefault(){}});assert.equal(get('chat-input').value,'<img src=x onerror=alert(1)>');
await get('chat-form').events.submit({preventDefault(){}});await flush();assert.equal(messages.length,1);assert.equal(get('chat-input').value,'');
const writes=requests.filter(r=>r.payload);assert.equal(writes[0].payload.client_id,writes[1].payload.client_id);
const rendered=get('chat-log').children.find(el=>el.dataset.messageId==='1');assert.equal(rendered.children[1].textContent,'<img src=x onerror=alert(1)>');
// Catch up more than two pages without losing the polling timer or skipping messages.
for(let i=0;i<115;i++)messages.push({id:messages.length+1,user_id:'two',author:'다른 관측자',body:'message '+i,created_at:'2026-11-20T00:00:00Z'});
for(let page=0;page<3;page++){
 const [id,task]=timers.entries().next().value;timers.delete(id);task.fn();await flush();
}
assert.equal(get('chat-log').children.filter(el=>el.dataset.messageId).length,116);
assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,5000);
get('chat-input').value='draft';get('chat-close').events.click();assert.equal(timers.size,0);assert.equal(get('chat-toggle').attributes['aria-expanded'],'false');
get('chat-toggle').events.click();await flush();assert.equal(get('chat-input').value,'draft');
context.observer=null;windowEvents.observerchange();assert.equal(get('chat-input').value,'');assert.equal(get('chat-form').hidden,true);
context.document.hidden=true;documentEvents.visibilitychange();assert.equal(timers.size,0);
get('chat-close').events.click();assert.equal(timers.size,0);
console.log('PASS: hidden entry gate, launcher open/close, guest/login state, safe text rendering, retry deduplication, multi-page catch-up, polling lifecycle and draft isolation.');
