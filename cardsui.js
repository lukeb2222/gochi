const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],SUITS=['♣','♦','♠','♥'];
const CARDCSS=`.hz-score{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.hz-p{padding:10px;border-radius:9px;background:#17211e;text-align:center}.hz-p.on{outline:2px solid #d8ff5a}.hz-p strong{display:block;font-size:26px}.hz-p small{display:block;color:#94a499;font-size:11px}.hz-felt{background:#1d5a3a!important;min-height:140px;justify-content:center}.hz-trick{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;text-align:center}.hz-t small{display:block;color:#cfe;font-size:12px}.hz-note{text-align:center;color:#cfe}.hz-status{font-weight:700;margin:10px 0}.hz-hand{display:flex;flex-wrap:wrap;gap:0;justify-content:center;padding-top:14px}.hz-c{background:none;border:0;padding:0;cursor:pointer}@media(max-width:700px){.hz-score{grid-template-columns:repeat(2,1fr)}}
.card-table{grid-column:1/-1;margin-top:22px;padding:22px;border:1px solid var(--line,#2c3a34);border-radius:12px;background:#1a2420}
.card-table h2{margin:4px 0 6px}.ct-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:14px 0}.ct-controls label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a499}.ct-controls select,.ct-controls input{padding:9px 10px;border-radius:7px;border:1px solid #33443d;background:#121a17;color:#f2efe6}.ct-controls input{width:80px}
.ct-games{display:flex;gap:8px}.ct-pick.on{outline:2px solid #d8ff5a}.ct-list{display:grid;gap:8px}.ct-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid #2c3a34;border-radius:9px}.ct-row small{display:block;color:#94a499}.ct-acts{display:flex;gap:8px}
.pc{display:inline-flex;align-items:center;justify-content:center;gap:1px;min-width:42px;height:60px;padding:0 6px;border-radius:7px;background:#f8f5ee;font-weight:700;font-size:18px;box-shadow:0 2px 6px #0006;margin:2px}.pc.red{color:#c8283b}.pc.blk{color:#17211e}.pc.back{background:repeating-linear-gradient(45deg,#3a4fbf,#3a4fbf 5px,#2a3a96 5px,#2a3a96 10px);color:transparent}.pc.sel{transform:translateY(-10px);outline:2px solid #d8ff5a}.pc.dim{opacity:.35}.pc.sm{min-width:34px;height:48px;font-size:15px}
.cg-banner{margin:14px 0;padding:12px 16px;border-radius:9px;background:#26332d;font-weight:700}.cg-banner.win{background:#2f5a2c}.cg-banner.loss{background:#5a2c2c}.cg-banner.draw{background:#4a4a2c}
.cg-board{display:flex;gap:16px;align-items:center;justify-content:space-between;margin:18px 0;padding:18px;border-radius:12px;background:#17211e}.war-pile{text-align:center;min-width:90px}.war-pile strong{display:block;font-size:34px}.war-mid{flex:1;text-align:center}.war-steps{display:flex;flex-direction:column;gap:6px;align-items:center}.war-step{display:flex;gap:14px;align-items:center}
.cg-acts{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
@media(max-width:700px){.cg-board{flex-direction:column}.pc{min-width:36px;height:52px;font-size:16px}}`;
export function installCards(ctx){
 if(!document.getElementById('cardcss'))document.head.insertAdjacentHTML('beforeend','<style id="cardcss">'+CARDCSS+'</style>');
 const {S,$,esc,notify}=ctx;
 const NAMES={war:'War',hearts:'Hearts',poker:'Poker'};
 const AVAILABLE=['war','hearts'];
 async function capi(action,body){let token=await S.user.getIdToken();let r=await fetch('/.netlify/functions/cards',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action,...body})});return r.json()}
 const card=(c,cls='')=>c==null?'':c<0?`<span class="pc back ${cls}"></span>`:`<span class="pc ${Math.floor(c/13)%2?'red':'blk'} ${cls}"><b>${RANKS[c%13]}</b>${SUITS[Math.floor(c/13)]}</span>`;
 function lobbyHTML(){
  let others=S.people.filter(p=>p.id!==S.user.uid);
  return `<section class="card-table"><div class="eyebrow">CARD TABLE</div><h2>Cards<span>.</span></h2><p>Play against a robot or challenge another member. The robots play to win, so expect to lose points sometimes. Play points only, never money.</p>
  <div class="ct-controls"><div class="ct-games">${Object.keys(NAMES).map(g=>`<button class="secondary ct-pick${g==='war'?' on':''}" data-ctgame="${g}" ${AVAILABLE.includes(g)?'':'disabled'}>${NAMES[g]}${AVAILABLE.includes(g)?'':' (soon)'}</button>`).join('')}</div>
  <label>Opponent <select id="ct-opp"><option value="bot">Robot</option>${others.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
  <label>Stake <input id="ct-stake" type="number" min="1" max="25" value="5"></label><button class="primary" id="ct-start">Start game</button></div>
  <p class="muted" id="ct-hint"></p><div id="ct-list" class="ct-list"><p class="muted">Loading your games…</p></div></section>`}
 function bindLobby(){
  S.cgGame='war';S.cg=null;
  const hint=()=>{let g=S.cgGame;$('#ct-hint').textContent=({war:'War: 1-25 stake. Winner takes 2x. Pure luck, and the bot cannot do better than you here.',hearts:'Hearts: 1-25 stake. Lowest score wins. 1st pays 3x, 2nd gets stake back.',poker:'Poker: heads-up fixed-limit Hold\'em, stake 1-5 per bet unit.'})[g]||''};
  hint();
  document.querySelectorAll('[data-ctgame]').forEach(b=>b.onclick=()=>{if(b.disabled)return;S.cgGame=b.dataset.ctgame;document.querySelectorAll('[data-ctgame]').forEach(x=>x.classList.toggle('on',x===b));$('#ct-stake').max=S.cgGame==='poker'?5:25;hint()});
  $('#ct-start').onclick=async()=>{let b=$('#ct-start'),stake=Number($('#ct-stake').value),opp=$('#ct-opp').value;b.disabled=true;try{let r=await capi('create',{type:S.cgGame,mode:opp==='bot'?'bot':'pvp',opponentId:opp==='bot'?undefined:opp,stake,requestId:crypto.randomUUID()});if(!r.ok)throw Error(r.error||'Could not start');if(r.game.status==='active')openGame(r.game.id);else{notify('Challenge sent. It starts when they accept.');loadList()}}catch(e){notify(e.message)}finally{b.disabled=false}};
  loadList();
 }
 async function loadList(){
  let box=$('#ct-list');if(!box)return;
  try{let r=await capi('list',{});if(!r.ok)throw Error(r.error);let me=S.user.uid;
   box.innerHTML=r.games.length?r.games.map(g=>{let opp=g.seats.filter(s=>s.uid!==me).map(s=>s.name).join(', '),mine=g.invitedBy===me;
    return `<div class="ct-row"><div><strong>${NAMES[g.type]}</strong> vs ${esc(opp)}<small>${g.status==='invited'?(mine?'Waiting for them to accept':'Challenge: stake '+g.stake):'In progress'} · stake ${g.stake}</small></div><div class="ct-acts">${g.status==='active'?`<button class="primary" data-open="${g.id}">Open</button>`:mine?`<button class="secondary" data-cancel="${g.id}">Cancel</button>`:`<button class="primary" data-accept="${g.id}">Accept</button><button class="secondary" data-decline="${g.id}">Decline</button>`}</div></div>`}).join(''):'<p class="muted">No games in progress.</p>';
   box.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openGame(b.dataset.open));
   for(let [k,a] of [['cancel','cancel'],['decline','decline'],['accept','accept']])box.querySelectorAll(`[data-${k}]`).forEach(b=>b.onclick=async()=>{b.disabled=true;try{let r=await capi(a,{id:b.dataset[k]});if(!r.ok)throw Error(r.error);if(a==='accept')openGame(b.dataset[k]);else loadList()}catch(e){notify(e.message);b.disabled=false}});
  }catch(e){box.innerHTML='<p class="muted">Could not load games: '+esc(e.message)+'</p>'}
 }
 async function openGame(id){S.cg={id,view:null};await refresh();poll(id)}
 async function refresh(){let r=await capi('view',{id:S.cg.id});if(!r.ok){notify(r.error||'Could not load game');S.cg=null;ctx.back();return}S.cg.view=r.game;render()}
 function poll(id){clearInterval(S.cgTimer);S.cgTimer=setInterval(async()=>{if(!S.cg||S.cg.id!==id||S.tab!=='play'){clearInterval(S.cgTimer);return}let v=S.cg.view;if(!v||v.over&&v.status!=='invited')return;if(S.cg.busy)return;try{let r=await capi('view',{id});if(r.ok&&S.cg&&S.cg.id===id&&(r.game.v!==v.v||r.game.status!==v.status)){S.cg.view=r.game;render()}}catch{}},2500)}
 async function send(move){if(S.cg.busy)return;S.cg.busy=true;try{let r=await capi('move',{id:S.cg.id,v:S.cg.view.v,move});if(!r.ok)throw Error(r.error||'Move failed');S.cg.view=r.game;render()}catch(e){notify(e.message);try{await refresh()}catch{}}finally{S.cg.busy=false}}
 async function timeoutClaim(){try{let r=await capi('timeout',{id:S.cg.id});if(!r.ok)throw Error(r.error);S.cg.view=r.game;render()}catch(e){notify(e.message)}}
 function banner(v){
  if(v.status==='invited')return `<div class="cg-banner">Waiting for the other player to accept…</div>`;
  if(v.status!=='done')return '';
  let got=(v.result?.payouts||[])[v.seat]||0,net=got-v.stake*(v.type==='poker'?13:1);
  if(v.type==='hearts')return `<div class="cg-banner ${got>v.stake?'win':got===v.stake?'draw':'loss'}">${got>v.stake?`You won! Paid ${got} play points.`:got===v.stake?`Second place. Stake returned (${got}).`:`You lost. ${v.stake} play points gone.`}</div>`;
  return `<div class="cg-banner ${got>v.stake?'win':got===v.stake?'draw':'loss'}">${got>v.stake?`You won! Paid ${got} play points.`:got===v.stake?`Draw. Stake returned (${got}).`:`You lost. ${v.stake} play points gone.`}</div>`}
 const R={};
 R.war=v=>{let g=v.game,l=g.last,seat=v.seat,opp=v.seats.find((s,i)=>i!==seat);
  let waiting=!g.over&&g.you.ready;
  return `<div class="cg-board war"><div class="war-pile"><small>${esc(opp.name)}</small><strong>${g.opp.count}</strong><small>cards</small></div><div class="war-mid">${l?`<div class="war-steps">${l.steps.map(([a,b])=>`<div class="war-step">${card(b)}<span>vs</span>${card(a)}</div>`).join('')}</div><p>${l.youWon?'You take it':'They take it'}${l.war?' after a WAR':''} (${l.won} cards)</p>`:'<p>Flip to start.</p>'}<small>Round ${g.round} of ${g.maxRounds}</small></div><div class="war-pile you"><small>You</small><strong>${g.you.count}</strong><small>cards</small></div></div>
  <div class="cg-acts">${g.over?'':`<button class="primary" id="cg-flip" ${waiting?'disabled':''}>${waiting?'Waiting for them…':'Flip'}</button>${v.seats.some((s,i)=>i!==seat&&s.bot)?'<button class="secondary" id="cg-auto">Auto x25</button>':''}${waiting?'<button class="secondary" id="cg-timeout">Opponent idle? Claim win</button>':''}`}</div>`};
 const BIND={war:()=>{$('#cg-flip')&&($('#cg-flip').onclick=()=>send({t:'flip'}));$('#cg-auto')&&($('#cg-auto').onclick=()=>send({t:'flip',n:25}))}};

 R.hearts=v=>{let g=v.game,me=v.seat,nm=i=>i===me?'You':v.seats[i].name,sel=S.cg.sel||[],myTurn=g.phase==='play'&&g.turn===me&&!g.over,pass=g.phase==='pass'&&!g.passed&&!g.over;
  const DIR={1:'left',3:'right',2:'across'};
  let sc=[0,1,2,3].map(k=>{let i=(me+k)%4;return `<div class="hz-p${g.turn===i&&g.phase==='play'&&!g.over?' on':''}"><small>${esc(nm(i))}${v.seats[i].bot?' 🤖':''}</small><strong>${g.scores[i]}</strong><small>+${g.handPts[i]} this hand · ${g.counts[i]} cards</small></div>`}).join('');
  let tr=g.trick.length?g.trick.map(t=>`<div class="hz-t"><small>${esc(nm(t.seat))}</small>${card(t.card)}</div>`).join(''):(g.lastTrick?`<div class="hz-note">Last trick: ${esc(nm(g.lastTrick.winner))} took it${g.lastTrick.pts?` (${g.lastTrick.pts} pts)`:''}<div>${g.lastTrick.cards.map(t=>card(t.card,'sm')).join('')}</div></div>`:'');
  let rec=g.recent&&g.recent.length?`<p class="muted">${g.recent.map(t=>esc(nm(t.seat))+' played '+RANKS[t.card%13]+SUITS[Math.floor(t.card/13)]).join(' · ')}</p>`:'';
  let status=g.over?'Game over.':g.phase==='pass'?(g.passed?'Waiting for the others to pass…':`Pick 3 cards to pass ${DIR[g.passDir]} (${sel.length}/3)`):myTurn?'Your turn. Lowest score wins. Hearts are 1 each, Q♠ is 13.':`Waiting for ${esc(nm(g.turn))}…`;
  let waitOther=!g.over&&!myTurn&&!pass&&v.seats.some((s,i)=>i!==me&&s.uid&&(g.phase==='play'?g.turn===i:!g.passedBy[i]));
  return `<div class="hz"><div class="hz-score">${sc}</div><p class="muted">Hand ${g.handNo} · first to ${g.target} ends the game${g.gotPass&&g.tricks===0?' · you received '+g.gotPass.map(c=>RANKS[c%13]+SUITS[Math.floor(c/13)]).join(' '):''}</p>
  <div class="cg-board hz-felt"><div class="hz-trick">${tr||'<p>Play starts with the 2♣.</p>'}</div></div>${rec}<p class="hz-status">${status}</p>
  <div class="hz-hand">${g.hand.map(c=>`<button class="hz-c" data-c="${c}">${card(c,(sel.includes(c)?'sel ':'')+(myTurn&&!g.legal.includes(c)?'dim':''))}</button>`).join('')}</div>
  <div class="cg-acts">${pass?`<button class="primary" id="hz-pass" ${sel.length===3?'':'disabled'}>Pass 3 cards</button>`:''}${waitOther?'<button class="secondary" id="cg-timeout">Opponent idle? Claim win</button>':''}</div></div>`};
 BIND.hearts=()=>{let g=S.cg.view.game;S.cg.sel=S.cg.sel||[];
  document.querySelectorAll('.hz-c').forEach(b=>b.onclick=async()=>{let c=Number(b.dataset.c);
   if(g.phase==='pass'&&!g.passed){let i=S.cg.sel.indexOf(c);if(i>=0)S.cg.sel.splice(i,1);else if(S.cg.sel.length<3)S.cg.sel.push(c);render();return}
   if(g.phase==='play'&&g.turn===g.seat&&g.legal.includes(c))await send({t:'play',card:c})});
  $('#hz-pass')&&($('#hz-pass').onclick=async()=>{let cs=S.cg.sel.slice();S.cg.sel=[];await send({t:'pass',cards:cs})});
 };
 function render(){
  let v=S.cg?.view;if(!v||S.tab!=='play')return;
  let opp=v.seats.filter((s,i)=>i!==v.seat).map(s=>(s.bot?'🤖 ':'')+s.name).join(', ');
  $('#main').innerHTML=`<div class="play-page cg-page"><div class="play-head"><div><div class="eyebrow">CARD TABLE / ${NAMES[v.type].toUpperCase()}</div><h1>${NAMES[v.type]} vs ${esc(opp)}<span>.</span></h1><p>Stake ${v.stake} play points.</p></div><div class="play-wallet"><small>PLAY POINTS</small><strong>${S.profile.points||0}</strong><button class="secondary" id="cg-back">Back to Play</button></div></div>${banner(v)}${v.game?R[v.type](v):''}</div>`;
  $('#cg-back').onclick=()=>{clearInterval(S.cgTimer);S.cg=null;ctx.back()};
  if(v.game)BIND[v.type]?.();
  let to=$('#cg-timeout');if(to)to.onclick=timeoutClaim;
 }
 return {lobbyHTML,bindLobby,register(type,renderer,binder){R[type]=renderer;BIND[type]=binder;if(!AVAILABLE.includes(type))AVAILABLE.push(type)},helpers:{card,send,$,esc}};
}
