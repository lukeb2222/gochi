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
__m.hearts=(function(){const module={exports:{}};
const {shuffle,deck52}=__m.cardcore;
// suits: 0 clubs, 1 diamonds, 2 spades, 3 hearts. rank 0..12 = 2..A
const suit=c=>Math.floor(c/13),rank=c=>c%13,QS=36,TARGET=50;
const pts=c=>suit(c)===3?1:c===QS?13:0;
const DIRS=[1,3,2,0];
function deal(s){
 let d=shuffle(deck52());s.hands=[0,1,2,3].map(i=>d.slice(i*13,i*13+13).sort((a,b)=>a-b));
 s.taken=[[],[],[],[]];s.trick=[];s.tricks=0;s.broken=false;s.played=[];s.passSel=[null,null,null,null];s.lastTrick=null;
 s.passDir=DIRS[s.handNo%4];s.phase=s.passDir?'pass':'play';
 if(s.phase==='play')startPlay(s);
}
function startPlay(s){s.phase='play';s.turn=s.hands.findIndex(h=>h.includes(0));s.leader=s.turn}
function create(bots,stake){let s={handNo:0,scores:[0,0,0,0],handScores:null,over:false,winner:null,hist:[],recent:[]};deal(s);advance(s,bots);return s}
function legal(s,seat){
 let h=s.hands[seat];
 if(!s.trick.length){
  if(s.tricks===0)return h.includes(0)?[0]:h.slice();
  let nh=h.filter(c=>suit(c)!==3);return(s.broken||!nh.length)?h.slice():nh;
 }
 let ls=suit(s.trick[0].card),f=h.filter(c=>suit(c)===ls);if(f.length)return f;
 if(s.tricks===0){let np=h.filter(c=>suit(c)!==3&&c!==QS);if(np.length)return np}
 return h.slice();
}
// --- bot ---
function unseen(s,seat){let seen=new Set([...s.hands[seat],...s.played]);let u=[];for(let c=0;c<52;c++)if(!seen.has(c))u.push(c);return u}
function botPass(s,seat){
 let h=s.hands[seat],cnt=[0,0,0,0];h.forEach(c=>cnt[suit(c)]++);
 let sc=h.map(c=>{let su=suit(c),r=rank(c),v=r;
  if(su===2){if(c===QS)v=cnt[2]<=4?200:20;else if(r>=11)v=cnt[2]<=3?150+r:r}
  else if(su===3){v=r>=8?60+r*2:r+(cnt[3]<=3?-10:8)}
  else{v=r+(cnt[su]<=2?35-6*cnt[su]:0)}
  return [v,c]});
 sc.sort((a,b)=>b[0]-a[0]);return sc.slice(0,3).map(x=>x[1]);
}
function botPlay(s,seat){
 let L=legal(s,seat);if(L.length===1)return L[0];
 let un=unseen(s,seat),qsOut=un.includes(QS),h=s.hands[seat];
 if(!s.trick.length){
  let best=null,bv=1e9;
  for(let c of L){
   let su=suit(c),r=rank(c),lo=un.filter(x=>suit(x)===su&&rank(x)<r).length,hi=un.filter(x=>suit(x)===su&&rank(x)>r).length;
   let others=un.filter(x=>suit(x)===su).length;
   let pw=others===0?0.9:Math.pow((lo+0.3)/(lo+hi+0.3),Math.min(3,Math.max(1,others)));
   let exp=1+(su===3?3:0)+(su===2&&qsOut&&!h.includes(QS)?5:0)+pts(c);
   if(su===2&&h.includes(QS)&&c!==QS&&r>10)exp+=14;
   if(su===3&&!s.broken)exp+=3;
   let v=pw*exp+r*0.01+(others===0?2:0);
   if(v<bv){bv=v;best=c}
  }
  return best;
 }
 let ls=suit(s.trick[0].card),f=L.filter(c=>suit(c)===ls);
 let win=s.trick.filter(t=>suit(t.card)===ls).reduce((a,t)=>rank(t.card)>rank(a)?t.card:a,-1);
 let tp=s.trick.reduce((a,t)=>a+pts(t.card),0),last=s.trick.length===3;
 if(f.length){
  let lower=f.filter(c=>rank(c)<rank(win));
  if(lower.length){if(ls===2&&lower.includes(QS)&&rank(win)>10)return QS;return lower.reduce((a,c)=>rank(c)>rank(a)?c:a)}
  let nq=f.filter(c=>c!==QS),pool=nq.length?nq:f;
  if(last)return pool.reduce((a,c)=>rank(c)>rank(a)?c:a);
  // forced to win, others still to play: if spades led and Q-spade unseen, losing high spade is risky
  return pool.reduce((a,c)=>rank(c)<rank(a)?c:a);
 }
 // void: dump
 let best=null,bv=-1e9,cnt=[0,0,0,0];h.forEach(c=>cnt[suit(c)]++);
 for(let c of L){
  let su=suit(c),r=rank(c),v;
  if(c===QS)v=1000;
  else if(su===2&&r>=11&&qsOut)v=900+r;
  else if(su===3)v=500+r;
  else v=r+(cnt[su]<=2?20-4*cnt[su]:0);
  if(v>bv){bv=v;best=c}
 }
 return best;
}
// --- engine ---
function playCard(s,seat,c){
 s.hands[seat]=s.hands[seat].filter(x=>x!==c);s.trick.push({seat,card:c});s.played.push(c);s.recent.push({seat,card:c});
 if(suit(c)===3)s.broken=true;
 if(s.trick.length<4){s.turn=(seat+1)%4;return}
 let ls=suit(s.trick[0].card),w=s.trick.filter(t=>suit(t.card)===ls).reduce((a,t)=>rank(t.card)>rank(a.card)?t:a);
 let p=s.trick.reduce((a,t)=>a+pts(t.card),0);
 s.taken[w.seat].push(...s.trick.map(t=>t.card));
 s.lastTrick={cards:s.trick.slice(),winner:w.seat,pts:p};s.trick=[];s.tricks++;
 if(s.tricks===13){endHand(s);return}
 s.turn=w.seat;s.leader=w.seat;
}
function endHand(s){
 let hp=s.taken.map(t=>t.reduce((a,c)=>a+pts(c),0));
 let moon=hp.findIndex(x=>x===26);
 if(moon>=0)hp=hp.map((x,i)=>i===moon?0:26);
 s.handScores=hp;s.scores=s.scores.map((x,i)=>x+hp[i]);s.hist.push({hp,moon:moon>=0?moon:null});
 if(Math.max(...s.scores)>=TARGET){
  s.over=true;let m=Math.min(...s.scores);s.winner=s.scores.map((x,i)=>x===m?i:-1).filter(i=>i>=0);s.phase='over';return;
 }
 s.handNo++;s.prevHand={hp,moon:moon>=0?moon:null};
 let keep={handNo:s.handNo,scores:s.scores,hist:s.hist,recent:s.recent,prevHand:s.prevHand,over:false,winner:null,handScores:null};
 for(let k of Object.keys(s))delete s[k];Object.assign(s,keep);deal(s);
}
function doPass(s){
 let d=s.passDir,sel=s.passSel,nh=s.hands.map(h=>h.slice());
 for(let i=0;i<4;i++){let to=(i+d)%4;nh[i]=nh[i].filter(c=>!sel[i].includes(c))}
 for(let i=0;i<4;i++){let to=(i+d)%4;nh[to].push(...sel[i])}
 s.hands=nh.map(h=>h.sort((a,b)=>a-b));s.passed={dir:d,got:[0,1,2,3].map(i=>sel[(i+4-d)%4])};s.passSel=[null,null,null,null];startPlay(s);
}
function advance(s,bots){
 for(let guard=0;guard<400&&!s.over;guard++){
  if(s.phase==='pass'){
   for(let i=0;i<4;i++)if(bots[i]&&!s.passSel[i])s.passSel[i]=botPass(s,i);
   if(s.passSel.every(x=>x))doPass(s);else return;
  }else{
   if(!bots[s.turn])return;
   playCard(s,s.turn,botPlay(s,s.turn));
  }
 }
}
function move(s,seat,m,bots){
 if(s.over)throw Error('Game is over');
 s.recent=[];
 if(s.phase==='pass'){
  if(m.t!=='pass')throw Error('Pick 3 cards to pass');
  if(s.passSel[seat])throw Error('You already passed');
  let c=Array.isArray(m.cards)?m.cards.map(Number):[];
  if(c.length!==3||new Set(c).size!==3||!c.every(x=>s.hands[seat].includes(x)))throw Error('Pick 3 different cards from your hand');
  s.passSel[seat]=c;
 }else{
  if(m.t!=='play')throw Error('Play a card');
  if(s.turn!==seat)throw Error('Not your turn');
  let c=Number(m.card);if(!legal(s,seat).includes(c))throw Error('You cannot play that card');
  playCard(s,seat,c);
 }
 advance(s,bots);
}
function view(s,seat){
 return{type:'hearts',phase:s.phase,over:s.over,winners:s.winner,handNo:s.handNo+1,target:TARGET,scores:s.scores,
  hand:s.hands[seat].slice(),counts:s.hands.map(h=>h.length),turn:s.turn,
  legal:s.phase==='play'&&s.turn===seat&&!s.over?legal(s,seat):[],
  passDir:s.passDir,passed:s.phase==='pass'?!!s.passSel[seat]:false,passedBy:s.phase==='pass'?s.passSel.map(x=>!!x):null,
  trick:s.trick,lastTrick:s.lastTrick,broken:s.broken,recent:s.recent,
  handPts:s.taken?s.taken.map(t=>t.reduce((a,c)=>a+pts(c),0)):[0,0,0,0],
  gotPass:s.passed&&s.tricks===0?s.passed.got[seat]:null,prevHand:s.prevHand||null,tricks:s.tricks,
  seat}
}
function payouts(s,stake){
 let order=s.scores.map((x,i)=>[x,i]).sort((a,b)=>a[0]-b[0]),prize=[3,1,0,0],out=[0,0,0,0];
 for(let i=0;i<4;){let j=i;while(j<4&&order[j][0]===order[i][0])j++;let tot=0;for(let k=i;k<j;k++)tot+=prize[k];for(let k=i;k<j;k++)out[order[k][1]]=Math.floor(tot*stake/(j-i));i=j}
 return out;
}
function waitingOn(s,bots){
 if(s.over)return[];
 if(s.phase==='pass'){let w=[];for(let i=0;i<4;i++)if(!bots[i]&&!s.passSel[i])w.push(i);return w.length===bots.filter(b=>!b).length?[]:w}
 return bots[s.turn]?[]:[s.turn];
}
function forfeit(s,seat,stake,escrow,bots){
 s.over=true;s.phase='over';s.forfeit=seat;
 let out=[0,0,0,0];for(let i=0;i<4;i++)if(!bots[i]&&i!==seat)out[i]=3*stake;
 s.winner=out.map((x,i)=>x?i:-1).filter(i=>i>=0);return out;
}
module.exports={create,move,view,payouts,waitingOn,forfeit,legal,botPlay,botPass,pts,TARGET,_t:{advance,playCard,deal}};

return module.exports})();
__m.poker=(function(){const module={exports:{}};
const {shuffle,deck52,randomInt}=__m.cardcore;
const rank=c=>c%13,suit=c=>Math.floor(c/13);
const NAMES=['High card','Pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
// 5-card score: category*13^5 + base-13 kickers
function score5(cs){
 let r=cs.map(rank).sort((a,b)=>b-a),fl=cs.every(c=>suit(c)===suit(cs[0]));
 let cnt={};r.forEach(x=>cnt[x]=(cnt[x]||0)+1);
 let groups=Object.entries(cnt).map(([k,v])=>[v,+k]).sort((a,b)=>b[0]-a[0]||b[1]-a[1]);
 let uniq=[...new Set(r)],str=-1;
 if(uniq.length===5){if(uniq[0]-uniq[4]===4)str=uniq[0];else if(uniq[0]===12&&uniq[1]===3)str=3}
 let cat,ks;
 if(str>=0&&fl){cat=8;ks=[str]}else if(groups[0][0]===4){cat=7;ks=[groups[0][1],groups[1][1]]}
 else if(groups[0][0]===3&&groups[1][0]===2){cat=6;ks=[groups[0][1],groups[1][1]]}
 else if(fl){cat=5;ks=r}else if(str>=0){cat=4;ks=[str]}
 else if(groups[0][0]===3){cat=3;ks=groups.map(g=>g[1])}
 else if(groups[0][0]===2&&groups[1][0]===2){cat=2;ks=groups.map(g=>g[1])}
 else if(groups[0][0]===2){cat=1;ks=groups.map(g=>g[1])}
 else{cat=0;ks=r}
 let v=cat;for(let i=0;i<5;i++)v=v*13+(ks[i]||0);return v;
}
const RC=new Int8Array(13),SC=new Int8Array(4),SM=new Int32Array(4);
const B5=371293;
function strHigh(m){for(let t=12;t>=4;t--)if(((m>>(t-4))&31)===31)return t;if((m&0x100F)===0x100F)return 3;return -1}
function enc(cat,ks){let v=cat;for(let i=0;i<5;i++)v=v*13+(ks[i]||0);return v}
function best7(cs){
 RC.fill(0);SC.fill(0);SM.fill(0);
 for(let i=0;i<cs.length;i++){const c=cs[i],r=c%13,su=(c/13)|0;RC[r]++;SC[su]++;SM[su]|=1<<r}
 let fs=-1;for(let k=0;k<4;k++)if(SC[k]>=5)fs=k;
 if(fs>=0){const h=strHigh(SM[fs]);if(h>=0)return enc(8,[h])}
 let quad=-1,trips=[],pairs=[];
 for(let r=12;r>=0;r--){if(RC[r]===4)quad=r;else if(RC[r]===3)trips.push(r);else if(RC[r]===2)pairs.push(r)}
 const top=(excl,n)=>{const o=[];for(let r=12;r>=0&&o.length<n;r--)if(RC[r]>0&&!excl.includes(r))o.push(r);return o};
 if(quad>=0)return enc(7,[quad,...top([quad],1)]);
 if(trips.length&&(trips.length>1||pairs.length)){const t=trips[0],p=trips.length>1?Math.max(trips[1],pairs[0]??-1):pairs[0];return enc(6,[t,p])}
 if(fs>=0){const o=[];for(let r=12;r>=0&&o.length<5;r--)if(SM[fs]>>r&1)o.push(r);return enc(5,o)}
 let m=0;for(let r=0;r<13;r++)if(RC[r])m|=1<<r;
 const sh=strHigh(m);if(sh>=0)return enc(4,[sh]);
 if(trips.length)return enc(3,[trips[0],...top([trips[0]],2)]);
 if(pairs.length>=2)return enc(2,[pairs[0],pairs[1],...top([pairs[0],pairs[1]],1)]);
 if(pairs.length===1)return enc(1,[pairs[0],...top([pairs[0]],3)]);
 return enc(0,top([],5));
}
const catOf=v=>Math.floor(v/Math.pow(13,5));
const BET=[1,1,2,2]; // bet size in units of u per street
function create(bots,stake){
 let d=shuffle(deck52());
 let s={deck:d.slice(4),hole:[[d[0],d[1]],[d[2],d[3]]],board:[],street:0,u:stake,button:randomInt(2),c:[stake,stake],bets:[0,0],nb:0,acted:[false,false],over:false,winner:null,folded:null,log:[],recent:[]};
 s.turn=1-s.button;advance(s,bots);return s;
}
function legal(s,seat){
 if(s.over||s.turn!==seat)return[];
 let owed=Math.max(...s.bets)-s.bets[seat];
 if(owed===0)return s.nb===0?['check','bet']:['check'];
 return s.nb<2?['fold','call','raise']:['fold','call'];
}
function put(s,seat,amt){s.c[seat]+=amt;s.bets[seat]+=amt}
function nextStreet(s){
 s.street++;s.bets=[0,0];s.nb=0;s.acted=[false,false];
 if(s.street===1)s.board.push(...s.deck.splice(0,3));else if(s.street<=3)s.board.push(s.deck.shift());
 if(s.street>3){showdown(s);return}
 s.turn=1-s.button;
}
function showdown(s){
 let v=[0,1].map(i=>best7([...s.hole[i],...s.board]));s.hv=v;
 s.winner=v[0]>v[1]?0:v[1]>v[0]?1:-1;s.over=true;s.showdown=true;
}
function act(s,seat,m){
 if(s.over)throw Error('Game is over');
 if(s.turn!==seat)throw Error('Not your turn');
 let t=m.t;if(!legal(s,seat).includes(t))throw Error('That action is not allowed now');
 let b=BET[s.street]*s.u,owed=Math.max(...s.bets)-s.bets[seat],o=1-seat;
 s.recent.push({seat,t});
 if(t==='fold'){s.over=true;s.folded=seat;s.winner=o;return}
 if(t==='check'){s.acted[seat]=true;if(s.acted[o])nextStreet(s);else s.turn=o;return}
 if(t==='call'){put(s,seat,owed);nextStreet(s);return}
 if(t==='bet'){put(s,seat,b);s.nb=1;s.acted[seat]=true;s.turn=o;return}
 if(t==='raise'){put(s,seat,owed+b);s.nb=2;s.turn=o;return}
}
// --- bot ---
function equity(s,seat,n){
 let h=s.hole[seat],known=new Set([...h,...s.board]),pool=[];for(let c=0;c<52;c++)if(!known.has(c))pool.push(c);
 let need=5-s.board.length,w=0;
 for(let i=0;i<n;i++){
  // partial Fisher-Yates for 2+need cards
  let k=2+need;for(let j=0;j<k;j++){let r=j+randomInt(pool.length-j);[pool[j],pool[r]]=[pool[r],pool[j]]}
  let opp=[pool[0],pool[1]],bd=s.board.concat(pool.slice(2,2+need));
  let a=best7([...h,...bd]),b=best7([...opp,...bd]);w+=a>b?1:a===b?0.5:0;
 }
 return w/n;
}
function botAct(s,seat){
 let L=legal(s,seat),pot=s.c[0]+s.c[1],owed=Math.max(...s.bets)-s.bets[seat],b=BET[s.street]*s.u,o=1-seat;
 let e=equity(s,seat,s.street===3?220:260),r=Math.random();
 let inPos=s.button===seat;
 if(owed>0){
  let adj=e-0.05*s.nb-(s.street>=2&&s.nb?0.03:0);
  let need=owed/(pot+owed);
  if(L.includes('raise')&&adj>0.74&&r<0.88)return 'raise';
  if(L.includes('raise')&&e<0.22&&r<0.05&&s.street<3)return 'raise';
  if(adj>need+0.02)return 'call';
  if(r<0.03&&need<0.34)return 'call';
  return 'fold';
 }
 if(L.includes('bet')){
  let th=inPos?0.54:0.58;
  if(e>0.86&&r<0.2)return 'check';
  if(e>th&&r<0.92)return 'bet';
  if(e<0.4&&r<(inPos?0.14:0.08)&&s.street<3)return 'bet';
  if(e<0.3&&r<0.06)return 'bet';
 }
 return 'check';
}
function advance(s,bots){
 for(let g=0;g<20&&!s.over;g++){if(!bots[s.turn])return;act(s,s.turn,{t:botAct(s,s.turn)})}
}
function move(s,seat,m,bots){s.recent=[];act(s,seat,m);advance(s,bots)}
function handName(v){return NAMES[catOf(v)]}
function view(s,seat){
 let o=1-seat,show=s.over&&s.showdown;
 return{type:'poker',over:s.over,street:s.street,board:s.board,hole:s.hole[seat],oppHole:show?s.hole[o]:null,
  pot:s.c[0]+s.c[1],you:{put:s.c[seat],bet:s.bets[seat]},opp:{put:s.c[o],bet:s.bets[o]},
  unit:s.u,bet:BET[s.street]*s.u,button:s.button,turn:s.turn,legal:legal(s,seat),owed:Math.max(...s.bets)-s.bets[seat],
  winner:s.winner,folded:s.folded,recent:s.recent,
  names:show?[handName(s.hv[seat]),handName(s.hv[o])]:null,seat};
}
function payouts(s,stake){
 let esc=13*stake,pot=s.c[0]+s.c[1],out=[esc-s.c[0],esc-s.c[1]];
 if(s.winner===-1){out[0]+=pot/2;out[1]+=pot/2}else out[s.winner]+=pot;
 return out;
}
function waitingOn(s,bots){return s.over||bots[s.turn]?[]:[s.turn]}
function forfeit(s,seat,stake){s.over=true;s.folded=seat;s.winner=1-seat;return payouts(s,stake)}
module.exports={create,move,view,payouts,waitingOn,forfeit,legal,best7,score5,botAct,equity,handName,_act:act};

return module.exports})();
const {initializeApp,cert,getApps}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const GAMES={war:__m.war,hearts:__m.hearts,poker:__m.poker};


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
