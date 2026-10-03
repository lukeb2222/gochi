const CSS=`.call-head-btns{display:flex;gap:6px;margin-left:auto}.call-head-btns .circle{width:38px;height:38px}
.call-banner{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:14px;align-items:center;padding:14px 18px;border-radius:14px;background:#1f3a2c;border:1px solid #d8ff5a;color:#f2efe6;box-shadow:0 10px 40px #000a;max-width:92vw}
.call-banner strong{display:block}.call-banner small{color:#b7c9bd}.call-banner button{padding:9px 14px;border-radius:9px;border:0;font-weight:700}.call-banner .acc{background:#d8ff5a;color:#17211e}.call-banner .dec{background:#5a2c2c;color:#fff}
.call-overlay{position:fixed;inset:0;z-index:9998;background:#0b100e;display:flex;flex-direction:column}.call-bar{display:flex;gap:10px;align-items:center;padding:10px 14px;background:#17211e;color:#f2efe6;flex-wrap:wrap}.call-bar strong{margin-right:auto}.call-bar button,.call-bar select{padding:8px 12px;border-radius:8px;border:1px solid #33443d;background:#26332d;color:#f2efe6}.call-bar .leave{background:#a83232;border-color:#a83232;font-weight:700}.call-grid{flex:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;padding:8px;overflow:auto;align-content:start}.call-tile{position:relative;background:#17211e;border-radius:12px;overflow:hidden;min-height:180px}.call-tile video{width:100%;height:100%;object-fit:cover;background:#101713;min-height:180px}.call-tile span{position:absolute;left:8px;bottom:8px;padding:3px 8px;border-radius:6px;background:#000a;color:#fff;font-size:13px}.call-tile.self video{transform:scaleX(-1)}`;
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
  banner.querySelector('.acc').onclick=()=>{stopRing();openCall(c.id,null,c.kind,c.roomName,false,[])};
  banner.querySelector('.dec').onclick=()=>{stopRing();capi('decline',{callId:c.id})};
  setTimeout(()=>{if(banner&&ringTimer)stopRing()},60000);
 }
 async function poll(){
  if(!S.user||document.visibilityState!=='visible'||current)return;
  try{let r=await capi('incoming',{});if(!r.ok)return;let c=r.calls.find(x=>!seen.has(x.id));if(c){seen.add(c.id);showBanner(c)}}catch{}
 }
 setInterval(poll,5000);
 async function openCall(id,_u,kind,roomName,owner,members){
  if(current)return;current=id;stopRing();
  let el=document.createElement('div');el.className='call-overlay';
  el.innerHTML=`<div class="call-bar"><strong>${kind==='audio'?'Audio':'Video'} call · ${esc(roomName)}</strong><span id="call-st" class="muted">Connecting…</span><button id="call-mute">Mute</button>${kind==='video'?'<button id="call-cam">Camera off</button>':''}${owner?'<select id="call-rm"><option value="">Remove someone…</option></select><button id="call-end">End for everyone</button>':''}<button class="leave">Leave</button></div><div class="call-grid" id="call-grid"></div>`;
  document.body.appendChild(el);
  const grid=el.querySelector('#call-grid'),st=el.querySelector('#call-st');
  let local=null,pcs={},names={},stopped=false,iceServers=[],tick=0;
  const tile=(uid,name,self)=>{let t=grid.querySelector(`[data-u="${uid}"]`);if(!t){t=document.createElement('div');t.className='call-tile'+(self?' self':'');t.dataset.u=uid;t.innerHTML=`<video autoplay playsinline ${self?'muted':''}></video><span>${esc(name)}${self?' (you)':''}</span>`;grid.appendChild(t)}return t.querySelector('video')};
  const close=async(leave=true)=>{if(stopped)return;stopped=true;current=null;Object.values(pcs).forEach(p=>{try{p.close()}catch{}});local?.getTracks().forEach(t=>t.stop());el.remove();if(leave)try{await capi('leave',{callId:id})}catch{}};
  el.querySelector('.leave').onclick=()=>close();
  try{
   local=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'?{facingMode:'user',width:{ideal:640},height:{ideal:480}}:false});
  }catch(e){notify('Could not use your '+(kind==='video'?'camera and microphone':'microphone')+'. Allow access in your browser settings and try again.');close(false);return}
  tile(S.user.uid,S.profile?.name||'You',true).srcObject=local;
  let mute=el.querySelector('#call-mute');mute.onclick=()=>{let t=local.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;mute.textContent=t.enabled?'Mute':'Unmute'};
  let cam=el.querySelector('#call-cam');if(cam)cam.onclick=()=>{let t=local.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;cam.textContent=t.enabled?'Camera off':'Camera on'};
  const sig=(to,type,sdp)=>capi('signal',{callId:id,to,type,sdp});
  const gather=pc=>new Promise(r=>{if(pc.iceGatheringState==='complete')return r();let d=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',d);r()}};pc.addEventListener('icegatheringstatechange',d);setTimeout(r,3500)});
  const drop=u=>{try{pcs[u]?.close()}catch{}delete pcs[u];grid.querySelector(`[data-u="${u}"]`)?.remove()};
  const mk=u=>{drop(u);let pc=new RTCPeerConnection({iceServers});pcs[u]=pc;local.getTracks().forEach(t=>pc.addTrack(t,local));pc.ontrack=e=>{tile(u,names[u]||'Member').srcObject=e.streams[0]};pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'){notify((names[u]||'Someone')+' could not connect (their network may block direct calls).');drop(u)}};return pc};
  const offerTo=async u=>{try{let pc=mk(u);await pc.setLocalDescription(await pc.createOffer());await gather(pc);await sig(u,'offer',pc.localDescription.sdp)}catch(e){console.error(e)}};
  const handle=async m=>{try{
   if(m.type==='offer'){let pc=mk(m.from);await pc.setRemoteDescription({type:'offer',sdp:m.sdp});await pc.setLocalDescription(await pc.createAnswer());await gather(pc);await sig(m.from,'answer',pc.localDescription.sdp)}
   else if(m.type==='answer'&&pcs[m.from]&&pcs[m.from].signalingState==='have-local-offer')await pcs[m.from].setRemoteDescription({type:'answer',sdp:m.sdp});
  }catch(e){console.error(e)}};
  let j;try{j=await capi('join',{callId:id});if(!j.ok)throw Error(j.error||'Could not join')}catch(e){notify(e.message);close(false);return}
  iceServers=j.ice||[];j.peers.forEach(p=>names[p.uid]=p.name);
  if(owner){let sel=el.querySelector('#call-rm');members.filter(m=>m.id!==S.user.uid).forEach(m=>sel.insertAdjacentHTML('beforeend',`<option value="${esc(m.id)}">${esc(m.name)}</option>`));
   el.querySelector('#call-end').onclick=async()=>{if(!confirm('End this call for everyone?'))return;try{await capi('end',{callId:id})}catch{}close()};
   sel.onchange=async e=>{let u=e.target.value;if(!u)return;let n=e.target.selectedOptions[0].textContent;if(!confirm('Remove '+n+' from this call?')){e.target.value='';return}try{let r=await capi('block',{callId:id,uid:u});if(!r.ok)throw Error(r.error);drop(u);notify(n+' was removed from the call.')}catch(x){notify(x.message)}e.target.value=''}}
  await Promise.all(j.peers.map(p=>offerTo(p.uid)));
  st.textContent=j.peers.length?'Connected':'Waiting for others to join…';
  (async()=>{while(!stopped){
   await new Promise(r=>setTimeout(r,tick<10?1200:2500));if(stopped)break;tick++;
   try{let r=await capi('poll',{callId:id,hb:tick%4===1});
    if(!r.ok)throw Error(r.error||'Call error');
    if(r.ended){notify('The call ended.');close(false);break}
    if(r.removed){notify('You were removed from the call.');close(false);break}
    r.peers.forEach(p=>names[p.uid]=p.name);
    for(let m of r.signals)await handle(m);
    for(let u of Object.keys(pcs))if(!r.peers.some(p=>p.uid===u)&&tick>3)drop(u);
    st.textContent=r.peers.length?`${r.peers.length+1} in the call`:'Waiting for others to join…';
   }catch(e){}
  }})();
 }
 async function startCall(kind){
  let r=S.room;if(!r)return;
  if(current)return notify('You are already in a call.');
  try{notify('Starting '+(kind==='audio'?'audio':'video')+' call…');let res=await capi('start',{roomId:r.id,kind});if(!res.ok)throw Error(res.error||'Could not start the call');
   let members=(r.members||[]).map(id=>({id,name:(S.people.find(p=>p.id===id)||{}).name||'Member'}));
   openCall(res.callId,null,res.kind||kind,r.name,true,members);
  }catch(e){notify(e.message)}
 }
 function headButtons(){return `<div class="call-head-btns"><button class="circle more" id="call-v" title="Video call">▶</button><button class="circle more" id="call-a" title="Audio call">☎</button></div>`}
 function bindHead(){$('#call-v')&&($('#call-v').onclick=()=>startCall('video'));$('#call-a')&&($('#call-a').onclick=()=>startCall('audio'))}
 return {headButtons,bindHead,startCall,poll};
}
