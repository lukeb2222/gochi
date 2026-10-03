const CSS=`.call-head-btns{display:flex;gap:6px;margin-left:auto}.call-head-btns .circle{width:38px;height:38px}
.call-banner{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:14px;align-items:center;padding:14px 18px;border-radius:14px;background:#1f3a2c;border:1px solid #d8ff5a;color:#f2efe6;box-shadow:0 10px 40px #000a;max-width:92vw}
.call-banner strong{display:block}.call-banner small{color:#b7c9bd}.call-banner button{padding:9px 14px;border-radius:9px;border:0;font-weight:700}.call-banner .acc{background:#d8ff5a;color:#17211e}.call-banner .dec{background:#5a2c2c;color:#fff}
.call-overlay{position:fixed;inset:0;z-index:9998;background:#0b100e;display:flex;flex-direction:column}.call-bar{display:flex;gap:10px;align-items:center;padding:10px 14px;background:#17211e;color:#f2efe6;flex-wrap:wrap}.call-bar strong{margin-right:auto}.call-bar button,.call-bar select{padding:8px 12px;border-radius:8px;border:1px solid #33443d;background:#26332d;color:#f2efe6}.call-bar .leave{background:#a83232;border-color:#a83232;font-weight:700}.call-overlay iframe{flex:1;border:0;width:100%}`;
export function installCalls(ctx){
 const {S,$,esc,notify}=ctx;
 if(!document.getElementById('callcss'))document.head.insertAdjacentHTML('beforeend','<style id="callcss">'+CSS+'</style>');
 async function capi(action,body){let token=await S.user.getIdToken();let r=await fetch('/.netlify/functions/calls',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action,...body})});return r.json()}
 let audioCtx=null,ringTimer=null,banner=null,seen=new Set(),current=null;
 function beep(){try{audioCtx||=new (window.AudioContext||window.webkitAudioContext)();let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=880;g.gain.value=.15;o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.25);setTimeout(()=>{try{let o2=audioCtx.createOscillator(),g2=audioCtx.createGain();o2.frequency.value=660;g2.gain.value=.15;o2.connect(g2);g2.connect(audioCtx.destination);o2.start();o2.stop(audioCtx.currentTime+.25)}catch{}},300)}catch{}}
 function stopRing(){clearInterval(ringTimer);ringTimer=null;banner?.remove();banner=null}
 function showBanner(c){
  if(banner||current)return;
  banner=document.createElement('div');banner.className='call-banner';
  banner.innerHTML=`<div><strong>${esc(c.from)} is calling</strong><small>${c.kind==='audio'?'Audio':'Video'} call · ${esc(c.roomName)}</small></div><button class="acc">Answer</button><button class="dec">Decline</button>`;
  document.body.appendChild(banner);beep();ringTimer=setInterval(beep,2500);
  banner.querySelector('.acc').onclick=async()=>{stopRing();try{let r=await capi('join',{callId:c.id});if(!r.ok)throw Error(r.error);openCall(c.id,r.url,r.kind,c.roomName,false,[])}catch(e){notify(e.message)}};
  banner.querySelector('.dec').onclick=()=>{stopRing();capi('decline',{callId:c.id})};
  setTimeout(()=>{if(banner&&ringTimer)stopRing()},60000);
 }
 async function poll(){
  if(!S.user||document.visibilityState!=='visible'||current)return;
  try{let r=await capi('incoming',{});if(!r.ok)return;let c=r.calls.find(x=>!seen.has(x.id));if(c){seen.add(c.id);showBanner(c)}}catch{}
 }
 setInterval(poll,5000);
 function openCall(id,url,kind,roomName,owner,members){
  current=id;stopRing();
  let el=document.createElement('div');el.className='call-overlay';
  let opts=members.filter(m=>m.id!==S.user.uid).map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
  el.innerHTML=`<div class="call-bar"><strong>${kind==='audio'?'Audio':'Video'} call · ${esc(roomName)}</strong>${owner?`<select id="call-rm"><option value="">Remove someone…</option>${opts}</select><button id="call-end">End for everyone</button>`:''}<button class="leave">Leave</button></div><iframe allow="camera; microphone; autoplay; display-capture; fullscreen" src="${esc(url)}"></iframe>`;
  document.body.appendChild(el);
  const close=()=>{el.remove();current=null};
  el.querySelector('.leave').onclick=close;
  if(owner){
   el.querySelector('#call-end').onclick=async()=>{if(!confirm('End this call for everyone?'))return;try{await capi('end',{callId:id})}catch{}close()};
   el.querySelector('#call-rm').onchange=async e=>{let u=e.target.value;if(!u)return;let n=e.target.selectedOptions[0].textContent;if(!confirm('Remove '+n+' from this call?')){e.target.value='';return}try{let r=await capi('block',{callId:id,uid:u});if(!r.ok)throw Error(r.error);notify(n+' was removed from the call.')}catch(x){notify(x.message)}e.target.value=''};
  }
 }
 async function startCall(kind){
  let r=S.room;if(!r)return;
  if(current)return notify('You are already in a call.');
  try{notify('Starting '+(kind==='audio'?'audio':'video')+' call…');let res=await capi('start',{roomId:r.id,kind});if(!res.ok)throw Error(res.error||'Could not start the call');
   let members=(r.members||[]).map(id=>({id,name:(S.people.find(p=>p.id===id)||{}).name||'Member'}));
   openCall(res.callId,res.url,res.kind||kind,r.name,true,members);
  }catch(e){notify(e.message)}
 }
 function headButtons(){return `<div class="call-head-btns"><button class="circle more" id="call-v" title="Video call">▶</button><button class="circle more" id="call-a" title="Audio call">☎</button></div>`}
 function bindHead(){$('#call-v')&&($('#call-v').onclick=()=>startCall('video'));$('#call-a')&&($('#call-a').onclick=()=>startCall('audio'))}
 return {headButtons,bindHead,startCall,poll};
}
