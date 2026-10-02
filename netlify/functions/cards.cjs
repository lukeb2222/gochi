// Bundled server module: card engines + endpoint (generated from netlify/lib sources).
const __m={};
__m.cardcore=(function(){const module={exports:{}};
const {randomInt}=require('node:crypto');
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){let j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
const deck52=()=>Array.from({length:52},(_,i)=>i);
const rank=c=>c%13,suit=c=>Math.floor(c/13);
module.exports={shuffle,deck52,rank,suit,randomInt};

return module.exports})();
__m.war=(function(){const module={exports:{}};
const {shuffle,deck52,rank}=__m.cardcore;
const MAX_ROUNDS=60;
function create(bots,stake){let d=shuffle(deck52());return{decks:[d.slice(0,26),d.slice(26)],ready:[false,false],round:0,over:false,winner:null,last:null,log:[]}}
function battle(s){
 let pile=[],a=s.decks[0],b=s.decks[1],steps=[];
 for(;;){
  if(!a.length||!b.length)break;
  let ca=a.shift(),cb=b.shift();pile.push(ca,cb);steps.push([ca,cb]);
  if(rank(ca)!==rank(cb)){let w=rank(ca)>rank(cb)?0:1;s.decks[w].push(...shuffle(pile));s.last={steps,winner:w,war:steps.length>1,won:pile.length};return}
  // war: 3 face down each, then compare next
  if(a.length<2||b.length<2){ // not enough cards to continue war: player short loses it
   let aShort=a.length<2,bShort=b.length<2,w=aShort&&!bShort?1:bShort&&!aShort?0:(a.length>=b.length?0:1);
   pile.push(...a.splice(0),...b.splice(0));s.decks[w].push(...shuffle(pile));s.last={steps,winner:w,war:true,won:pile.length};return}
  for(let i=0;i<Math.min(3,a.length-1,b.length-1);i++)pile.push(a.shift(),b.shift());
 }
 // someone empty before comparing
 let w=a.length?0:1;s.decks[w].push(...shuffle(pile));s.last={steps,winner:w,war:steps.length>1,won:pile.length};
}
function finishIfOver(s){
 let n0=s.decks[0].length,n1=s.decks[1].length;
 if(!n0||!n1){s.over=true;s.winner=n0?0:1}
 else if(s.round>=MAX_ROUNDS){s.over=true;s.winner=n0>n1?0:n1>n0?1:-1}
}
// move: {t:'flip',n}; seat is who is moving; bots[seat] flags
function move(s,seat,m,bots){
 if(s.over)throw Error('Game is over');
 if(m.t!=='flip')throw Error('Unknown move');
 let n=Math.max(1,Math.min(25,Number(m.n)||1));
 let botOpp=bots[1-seat];
 if(!botOpp)n=1;
 s.ready[seat]=true;
 for(let i=0;i<n&&!s.over;i++){
  if(botOpp)s.ready[1-seat]=true;
  if(s.ready[0]&&s.ready[1]){battle(s);s.round++;s.ready=[false,false];finishIfOver(s)}
  if(botOpp&&!s.over)s.ready[seat]=true;
 }
 if(botOpp)s.ready=[false,false];
}
function view(s,seat){
 return{type:'war',round:s.round,over:s.over,winner:s.winner,maxRounds:MAX_ROUNDS,
  you:{count:s.decks[seat].length,ready:s.ready[seat]},opp:{count:s.decks[1-seat].length,ready:s.ready[1-seat]},
  last:s.last?{steps:s.last.steps.map(([x,y])=>seat===0?[x,y]:[y,x]),youWon:s.last.winner===seat,war:s.last.war,won:s.last.won}:null}
}
// payout multiplier results per seat (units of stake incl. stake back)
function payouts(s,stake){if(s.winner===-1)return[stake,stake];return s.winner===0?[2*stake,0]:[0,2*stake]}
function waitingOn(s,bots){let w=[];for(let i=0;i<2;i++)if(!bots[i]&&!s.ready[i])w.push(i);return w.length===2?[]:w}
function forfeit(s,seat,stake){s.over=true;s.winner=1-seat;s.forfeit=seat;return s.winner===0?[2*stake,0]:[0,2*stake]}
module.exports={create,move,view,payouts,waitingOn,forfeit,MAX_ROUNDS};

return module.exports})();
const {initializeApp,cert,getApps}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const GAMES={war:__m.war};


const respond=(status,body)=>({statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
function init(){if(!getApps().length){if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw Error('Backend not configured');initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))})}return getFirestore()}
const BOTNAMES=['Robo Rex','Bolt','Circuit','Pixel','Gizmo','Sparky'];
// per-game config: seats, stake limits, escrow multiplier (units of stake), payout rules
const CFG={
 war:{seats:2,min:1,max:25,escrow:1,pvpSeats:[0,1]},
 hearts:{seats:4,min:1,max:25,escrow:1,pvpSeats:[0,1]},
 poker:{seats:2,min:1,max:5,escrow:13,pvpSeats:[0,1]}
};
const ids=a=>a.filter(s=>s.uid).map(s=>s.uid);
function summary(g,id){return{id,type:g.type,status:g.status,stake:g.stake,seats:g.seats.map(s=>({name:s.name,bot:!!s.bot,uid:s.uid||null})),updatedAt:g.updatedAt?.toMillis?.()||0,over:!!g.over,invitedBy:g.seats[0].uid}}
function viewFor(g,id,uid){
 let seat=g.seats.findIndex(s=>s.uid===uid);if(seat<0)throw Error('Not your game');
 let lib=GAMES[g.type];if(!g.state&&g.stateJson)g=({...g,state:JSON.parse(g.stateJson)});
 return{...summary(g,id),seat,v:g.v,turnSince:g.turnSince?.toMillis?.()||0,result:g.result||null,game:g.status==='active'||g.status==='done'?lib.view(g.state,seat,g):null}
}
async function settle(tx,gref,g,id,payoutUnits){
 // payoutUnits: per seat points to pay (already in points)
 g.result={payouts:payoutUnits,at:Date.now()};g.status='done';g.over=true;
 g.seats.forEach((s,i)=>{if(s.uid){let p=payoutUnits[i]||0;if(p>0)tx.update(s.userRef,{points:FieldValue.increment(p)})}});
}
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return respond(405,{ok:false,error:'POST required'});
 try{
  let db=init(),token=event.headers.authorization?.replace(/^Bearer /i,'');if(!token)return respond(401,{ok:false,error:'Sign in first'});
  let verified=await getAuth().verifyIdToken(token),uid=verified.uid,body=JSON.parse(event.body||'{}');
  let userRef=db.collection('users').doc(uid),user=await userRef.get();
  if(!user.exists||user.data().banned)return respond(403,{ok:false,error:'Account unavailable'});
  let me=user.data(),act=body.action;
  const ptr=u=>db.collection('users').doc(u).collection('cardGames');
  if(act==='list'){
   let snap=await ptr(uid).where('open','==',true).limit(30).get(),out=[];
   for(let d of snap.docs){let g=await db.collection('games').doc(d.id).get();if(g.exists)out.push(summary(g.data(),d.id))}
   out.sort((a,b)=>b.updatedAt-a.updatedAt);return respond(200,{ok:true,games:out});
  }
  if(act==='create'){
   let type=String(body.type||''),mode=String(body.mode||'bot'),cfg=CFG[type],lib=GAMES[type],stake=Number(body.stake),rid=String(body.requestId||'');
   if(!cfg||!lib)return respond(400,{ok:false,error:'Game not available yet'});
   if(!Number.isInteger(stake)||stake<cfg.min||stake>cfg.max)return respond(400,{ok:false,error:`Stake ${cfg.min}-${cfg.max}`});
   if(!/^[-a-f0-9]{36}$/.test(rid))return respond(400,{ok:false,error:'Bad request id'});
   let opp=null;
   if(mode==='pvp'){let oid=String(body.opponentId||'');if(!oid||oid===uid)return respond(400,{ok:false,error:'Pick another member'});let o=await db.collection('users').doc(oid).get();if(!o.exists||o.data().banned)return respond(404,{ok:false,error:'Member not found'});opp={uid:oid,name:String(o.data().name||'Member').slice(0,30)}}
   else if(mode!=='bot')return respond(400,{ok:false,error:'Bad mode'});
   let gref=db.collection('games').doc('g_'+rid),escrow=stake*cfg.escrow;
   let out=await db.runTransaction(async tx=>{
    let [gs,us]=await Promise.all([tx.get(gref),tx.get(userRef)]);
    if(gs.exists)return summary(gs.data(),gref.id);
    let u=us.data();if(!Number.isInteger(u.points)||u.points<escrow)throw Error(`Not enough play points (need ${escrow})`);
    let seats=[{uid,name:String(me.name||'You').slice(0,30)}];
    if(type==='hearts'){seats=[seats[0],opp?{...opp}:{bot:true,name:BOTNAMES[0]},{bot:true,name:BOTNAMES[1]},{bot:true,name:BOTNAMES[2]}]}
    else seats.push(opp?{...opp}:{bot:true,name:BOTNAMES[Math.floor(Math.random()*BOTNAMES.length)]});
    let g={type,stake,escrow,seats,uids:ids(seats),status:opp?'invited':'active',over:false,v:1,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),turnSince:FieldValue.serverTimestamp()};
    if(!opp){let st=lib.create(seats.map(s=>!!s.bot),stake);g.stateJson=JSON.stringify(st)}
    tx.update(userRef,{points:FieldValue.increment(-escrow)});
    tx.create(gref,g);tx.set(ptr(uid).doc(gref.id),{open:true,type,updatedAt:FieldValue.serverTimestamp()});
    if(opp)tx.set(ptr(opp.uid).doc(gref.id),{open:true,type,updatedAt:FieldValue.serverTimestamp()});
    return summary({...g,updatedAt:null},gref.id);
   });
   return respond(200,{ok:true,game:out});
  }
  let id=String(body.id||'');if(!/^g_[-a-f0-9]{36}$/.test(id))return respond(400,{ok:false,error:'Bad game id'});
  let gref=db.collection('games').doc(id);
  if(act==='view'){let s=await gref.get();if(!s.exists)return respond(404,{ok:false,error:'Game not found'});return respond(200,{ok:true,game:viewFor(s.data(),id,uid)})}
  if(act==='accept'||act==='decline'||act==='cancel'){
   let out=await db.runTransaction(async tx=>{
    let [gs,us]=await Promise.all([tx.get(gref),tx.get(userRef)]);if(!gs.exists)throw Error('Game not found');let g=gs.data();
    if(g.status!=='invited')throw Error('Game is no longer waiting');
    let lib=GAMES[g.type],creator=g.seats[0].uid,oppUid=g.seats.find((s,i)=>i>0&&s.uid)?.uid;
    if(act==='accept'){
     if(uid!==oppUid)throw Error('Not your invite');let u=us.data();if(!Number.isInteger(u.points)||u.points<g.escrow)throw Error(`Not enough play points (need ${g.escrow})`);
     g.seats.forEach(s=>{if(s.uid)s.userRef=null});
     let bots=g.seats.map(s=>!!s.bot),st=lib.create(bots,g.stake);g.stateJson=JSON.stringify(st);
     tx.update(userRef,{points:FieldValue.increment(-g.escrow)});
     tx.update(gref,{status:'active',stateJson:g.stateJson,updatedAt:FieldValue.serverTimestamp(),turnSince:FieldValue.serverTimestamp(),v:g.v+1});
     return {status:'active'};
    }
    if(act==='decline'&&uid!==oppUid)throw Error('Not your invite');
    if(act==='cancel'&&uid!==creator)throw Error('Not your game');
    tx.update(db.collection('users').doc(creator),{points:FieldValue.increment(g.escrow)});
    tx.update(gref,{status:'cancelled',over:true,updatedAt:FieldValue.serverTimestamp()});
    for(let u of g.uids)tx.set(ptr(u).doc(id),{open:false,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return {status:'cancelled'};
   });
   return respond(200,{ok:true,...out});
  }
  if(act==='move'||act==='timeout'){
   let out=await db.runTransaction(async tx=>{
    let gs=await tx.get(gref);if(!gs.exists)throw Error('Game not found');let g=gs.data();
    let seat=g.seats.findIndex(s=>s.uid===uid);if(seat<0)throw Error('Not your game');
    if(g.status!=='active')throw Error('Game is not active');g.state=JSON.parse(g.stateJson);
    let lib=GAMES[g.type],bots=g.seats.map(s=>!!s.bot),payUnits;
    if(act==='timeout'){
     let since=g.turnSince?.toMillis?.()||0;if(Date.now()-since<180000)throw Error('Opponent still has time');
     if(g.seats.filter(s=>s.uid).length<2)throw Error('No opponent to time out');
     let waiting=lib.waitingOn?lib.waitingOn(g.state,bots):[];if(!waiting.length||waiting.includes(seat))throw Error('It is your turn');
     payUnits=lib.forfeit(g.state,waiting[0],g.stake,g.escrow,bots);
    }else{
     if(Number(body.v)!==g.v)throw Error('Game changed, refreshing');
     lib.move(g.state,seat,body.move||{},bots,g.stake);
     if(g.state.over)payUnits=lib.payouts(g.state,g.stake,g.escrow,bots);
    }
    let upd={stateJson:JSON.stringify(g.state),v:g.v+1,updatedAt:FieldValue.serverTimestamp(),turnSince:FieldValue.serverTimestamp()};
    if(payUnits){
     g.seats.forEach((s,i)=>{if(s.uid){let p=payUnits[i]||0;if(p>0)tx.update(db.collection('users').doc(s.uid),{points:FieldValue.increment(p)});tx.set(ptr(s.uid).doc(id),{open:false,updatedAt:FieldValue.serverTimestamp()},{merge:true})}});
     upd.status='done';upd.over=true;upd.result={payouts:payUnits};
    }
    tx.update(gref,upd);
    g.v+=1;g.status=upd.status||g.status;g.result=upd.result||null;
    return viewFor({...g,turnSince:null,updatedAt:null},id,uid);
   });
   return respond(200,{ok:true,game:out});
  }
  return respond(400,{ok:false,error:'Unknown action'});
 }catch(err){console.error(err);return respond(400,{ok:false,error:err.message||'Request failed'})}
};
