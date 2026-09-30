const {initializeApp,cert,getApps}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getMessaging}=require('firebase-admin/messaging');
const {randomBytes,createHash}=require('node:crypto');
const items={hoodie:40,jacket:85,cap:35,crown:120,shades:55,spark:25,sunset:60,space:90};
function init(){if(!getApps().length){if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw Error('Backend not configured');initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))})}return getFirestore()}
const respond=(status,body)=>({statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
exports.handler=async event=>{if(event.httpMethod!=='POST')return respond(405,{ok:false,error:'POST required'});try{let db=init(),token=event.headers.authorization?.replace(/^Bearer /i,'');if(!token)return respond(401,{ok:false,error:'Sign in first'});let verified=await getAuth().verifyIdToken(token),uid=verified.uid,body=JSON.parse(event.body||'{}');let userRef=db.collection('users').doc(uid),user=await userRef.get();
 if(body.action==='issue-invite'){if(verified.email!=='lukebalyasny.11@gmail.com'||verified.email_verified!==true||!user.exists||user.data().banned)return respond(403,{ok:false,error:'Creator only'});let email=String(body.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return respond(400,{ok:false,error:'Enter a valid email'});let code=randomBytes(20).toString('hex');await db.collection('invites').doc(code).create({email,createdBy:uid,createdAt:FieldValue.serverTimestamp()});return respond(200,{ok:true,code,email})}
 if(body.action==='set-shared-invite'){
  if(verified.email!=='lukebalyasny.11@gmail.com'||verified.email_verified!==true||!user.exists||user.data().banned)return respond(403,{ok:false,error:'Creator only'});
  let code=String(body.code||'').trim();if(!/^[A-Za-z0-9]{8,40}$/.test(code))return respond(400,{ok:false,error:'Code must be 8-40 letters or numbers'});
  await db.collection('invites').doc(code).set({type:'shared',createdBy:uid,createdAt:FieldValue.serverTimestamp()});return respond(200,{ok:true,code})
 }
 if(body.action==='join-with-code'){
  if(user.exists)return respond(409,{ok:false,error:'Account already joined'});
  if(verified.email_verified!==true||!verified.email)return respond(403,{ok:false,error:'Use a verified Google account'});
  let code=String(body.code||'').trim(),name=String(body.name||'').trim().slice(0,30);
  if(!/^[A-Za-z0-9]{8,40}$/.test(code)||name.length<2)return respond(400,{ok:false,error:'Invalid code or name'});
  let invite=await db.collection('invites').doc(code).get();if(!invite.exists||invite.data().type!=='shared')return respond(403,{ok:false,error:'Welcome code not accepted'});
  let result=await db.runTransaction(async tx=>{
   let config=db.collection('settings').doc('vip'),state=await tx.get(config),old=[];
   if(!state.exists){let users=await tx.get(db.collection('users').orderBy('createdAt'));old=users.docs.filter(d=>d.data().role==='member').sort((a,b)=>(a.data().createdAt?.toMillis?.()||0)-(b.data().createdAt?.toMillis?.()||0));}
   let current=await tx.get(userRef);if(current.exists)throw Error('Account already joined');
   let slot=state.exists?state.data().awarded||0:Math.min(old.length,5),rank=slot<5?slot+1:null;
   if(!state.exists){for(let i=0;i<Math.min(old.length,5);i++)tx.update(old[i].ref,{vip:true,vipRank:i+1});tx.set(config,{awarded:Math.min(5,slot+(rank?1:0))})}
   else if(rank)tx.update(config,{awarded:rank});
   tx.create(userRef,{name,avatar:{skin:0,hair:0,hat:'',outfit:'',accessory:'',background:'',badge:''},credits:30,points:0,inventory:[],friends:[],pending:[],role:'member',banned:false,inviteCode:code,createdAt:FieldValue.serverTimestamp(),vip:!!rank,...(rank?{vipRank:rank}:{})});return rank
  });return respond(200,{ok:true,vipRank:result})
 }
 if(!user.exists||user.data().banned)return respond(403,{ok:false,error:'Account unavailable'});
 if(body.action==='vip-status'){
  let config=db.collection('settings').doc('vip'),state=await config.get();
  if(!state.exists){await db.runTransaction(async tx=>{let current=await tx.get(config);if(current.exists)return;let all=await tx.get(db.collection('users').orderBy('createdAt'));let members=all.docs.filter(d=>d.data().role==='member').sort((a,b)=>(a.data().createdAt?.toMillis?.()||0)-(b.data().createdAt?.toMillis?.()||0));for(let i=0;i<Math.min(5,members.length);i++)tx.update(members[i].ref,{vip:true,vipRank:i+1});tx.set(config,{awarded:Math.min(5,members.length)})})}
  return respond(200,{ok:true})
 }
 if(body.action==='vip-set'){
  if(verified.email!=='lukebalyasny.11@gmail.com'||verified.email_verified!==true||user.data().role!=='admin')return respond(403,{ok:false,error:'Creator only'});
  let target=String(body.userId||''),active=body.active;
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(target)||typeof active!=='boolean')return respond(400,{ok:false,error:'Invalid VIP change'});
  let ref=db.collection('users').doc(target),snap=await ref.get();if(!snap.exists||snap.data().role!=='member')return respond(404,{ok:false,error:'Member not found'});
  await ref.update({vip:active});return respond(200,{ok:true})
 }
 if(body.action==='push-register' || body.action==='push-remove'){
  let token=String(body.token||'');
  if(token.length<80||token.length>4096||!/^[A-Za-z0-9:_-]+$/.test(token))return respond(400,{ok:false,error:'Invalid device token'});
  let ref=userRef.collection('pushTokens').doc(createHash('sha256').update(token).digest('hex'));
  if(body.action==='push-remove'){await ref.delete();return respond(200,{ok:true})}
  let existing=await userRef.collection('pushTokens').limit(10).get();
  if(existing.size>=5&&!existing.docs.some(d=>d.id===ref.id))return respond(400,{ok:false,error:'Too many devices. Turn off notifications on an old device first.'});
  await ref.set({token,createdAt:FieldValue.serverTimestamp()});return respond(200,{ok:true})
 }
 if(body.action==='send-message'){
  let roomId=String(body.roomId||''),kind=String(body.kind||''),payload=body.payload;
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(roomId)||!['text','image','audio'].includes(kind)||typeof payload!=='string')return respond(400,{ok:false,error:'Invalid message'});
  if(kind==='text'&&(payload.trim().length<1||payload.length>1600)||kind!=='text'&&(payload.length<1||payload.length>520000||!payload.startsWith(kind==='image'?'data:image/jpeg;base64,':'data:audio/')))return respond(400,{ok:false,error:'Invalid message contents'});
  let roomRef=db.collection('rooms').doc(roomId),room=await roomRef.get();
  if(!room.exists)return respond(404,{ok:false,error:'Space not found'});
  let r=room.data();if(r.type!=='public'&&(!Array.isArray(r.members)||!r.members.includes(uid)))return respond(403,{ok:false,error:'Not a member of this space'});
  let text=kind==='text'?payload.trim():undefined,flagged=kind==='text'&&/\b(kill yourself|send nudes|nudes|suicide|self.harm|fuck you|doxx)\b/i.test(text);
  let message={uid,name:user.data().name,kind,createdAt:FieldValue.serverTimestamp(),flagged,reactions:{},[kind==='text'?'text':'media']:kind==='text'?text:payload};
  let ref=await roomRef.collection('messages').add(message);
  // The send is best effort: a stored message must not be reported as failed and retried if push is unavailable.
  try{
   let recipients=r.type==='public'?(await db.collection('users').where('banned','==',false).get()).docs.map(d=>d.id):r.members;
   let ids=[...new Set(recipients)].filter(id=>id!==uid).slice(0,500);
   let tokenDocs=(await Promise.all(ids.map(id=>db.collection('users').doc(id).collection('pushTokens').limit(5).get()))).flatMap((snap,i)=>snap.docs.map(d=>({doc:d,uid:ids[i],token:d.data().token})));
   for(let i=0;i<tokenDocs.length;i+=500){let batch=tokenDocs.slice(i,i+500),tokens=batch.map(t=>t.token);
    let result=await getMessaging().sendEachForMulticast({tokens,notification:{title:`${user.data().name} in ${String(r.name||'Gochi').slice(0,80)}`,body:kind==='text'?text.slice(0,150):kind==='image'?'Sent a photo':'Sent a voice memo'},webpush:{fcmOptions:{link:'https://gochi-world.netlify.app/'}}});
    await Promise.all(result.responses.map((res,j)=>!res.success&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(res.error?.code)?batch[j].doc.ref.delete():null));
   }
  }catch(pushError){console.error('Message stored; push failed:',pushError)}
  return respond(200,{ok:true,messageId:ref.id,flagged})
 }
 if(body.action==='join-room'){let code=String(body.code||'');if(!/^[a-f0-9]{18}$/.test(code))return respond(400,{ok:false,error:'Invalid space code'});let ref=db.collection('rooms').doc(code);let snap=await ref.get();if(!snap.exists||snap.data().type!=='private'||snap.data().code!==code)return respond(404,{ok:false,error:'Space not found'});await ref.update({members:FieldValue.arrayUnion(uid)});return respond(200,{ok:true,name:snap.data().name})}
 if(body.action==='claim-points'){
   let day=new Date().toISOString().slice(0,10);
   let balance=await db.runTransaction(async tx=>{let snap=await tx.get(userRef),u=snap.data();if(u.banned)throw Error('Account unavailable');if(u.lastPlayClaim===day)throw Error('Daily points already claimed');let next=Math.min(500,(u.points||0)+100);tx.update(userRef,{points:next,lastPlayClaim:day});return next});return respond(200,{ok:true,points:balance,claimDay:day})
 }
 if(body.action==='play-game'){
   let game=String(body.game||''),pick=String(body.pick||''),wager=Number(body.wager),requestId=String(body.requestId||'');
   if(!['coinflip','dice','highlow','colors','spinner','oddeven','digit'].includes(game)||!Number.isInteger(wager)||wager<1||wager>25||!/^[-a-f0-9]{36}$/.test(requestId)||!({coinflip:['heads','tails'],dice:['1','2','3','4','5','6'],highlow:['high','low'],colors:['red','blue','green'],spinner:['north','east','south','west'],oddeven:['odd','even'],digit:['0','1','2','3','4','5','6','7','8','9']}[game]||[]).includes(pick))return respond(400,{ok:false,error:'Invalid game choice'});
   let ref=db.collection('users').doc(uid).collection('plays').doc(requestId),roll=randomBytes(4).readUInt32BE(0),outcome=game==='coinflip'?['heads','tails'][roll%2]:game==='dice'?String(roll%6+1):game==='highlow'?roll%2?'high':'low':game==='colors'?['red','blue','green'][roll%3]:game==='spinner'?['north','east','south','west'][roll%4]:game==='oddeven'?roll%2?'odd':'even':String(roll%10);
   let result=await db.runTransaction(async tx=>{let [userSnap,playSnap]=await Promise.all([tx.get(userRef),tx.get(ref)]);if(playSnap.exists)return playSnap.data();let u=userSnap.data();if(u.banned||!Number.isInteger(u.points)||u.points<wager)throw Error('Not enough play points');let won=pick===outcome,multiplier=({coinflip:2,dice:5,highlow:2,colors:3,spinner:4,oddeven:2,digit:9})[game],payout=won?wager*multiplier:0,points=u.points-wager+payout;let receipt={game,pick,outcome,wager,won,payout,points,createdAt:FieldValue.serverTimestamp()};tx.update(userRef,{points});tx.create(ref,receipt);return receipt});return respond(200,{ok:true,...result})
 }
 if(body.action==='purchase'){let price=items[body.item];if(!price)return respond(400,{ok:false,error:'Unknown item'});await db.runTransaction(async tx=>{let snap=await tx.get(userRef),u=snap.data();if(u.banned||u.inventory?.includes(body.item)||u.credits<price)throw Error('Not enough credits or already owned');tx.update(userRef,{credits:u.credits-price,inventory:FieldValue.arrayUnion(body.item)})});return respond(200,{ok:true})}
 if(body.action==='join-event'){let eventId=String(body.eventId||'');if(!/^[A-Za-z0-9_-]{1,64}$/.test(eventId))return respond(400,{ok:false,error:'Invalid event'});let ref=db.collection('events').doc(eventId);await db.runTransaction(async tx=>{let [us,es]=await Promise.all([tx.get(userRef),tx.get(ref)]);if(!es.exists)throw Error('Event not found');let u=us.data(),e=es.data();if(u.banned||!Number.isInteger(e.fee)||e.fee<0||e.fee>500||e.attendees?.includes(uid)||u.credits<e.fee)throw Error('Already joined or not enough credits');tx.update(userRef,{credits:u.credits-e.fee});tx.update(ref,{attendees:FieldValue.arrayUnion(uid)})});return respond(200,{ok:true})}
 if(['ban','grant'].includes(body.action)){let code=String(body.code||''),role=code&&code===process.env.LUKE_ADMIN_CODE&&verified.email==='lukebalyasny.11@gmail.com'&&verified.email_verified===true?'Luke':code&&code===process.env.BAZ_ADMIN_CODE&&process.env.BAZ_ADMIN_EMAIL&&verified.email===process.env.BAZ_ADMIN_EMAIL&&verified.email_verified===true?'Baz':null;if(!role)return respond(403,{ok:false,error:'Wrong admin code'});let target=String(body.userId||'');if(!target||target===uid&&body.action==='ban')return respond(400,{ok:false,error:'Invalid member'});let ref=db.collection('users').doc(target),d=await ref.get();if(!d.exists)return respond(404,{ok:false,error:'Member not found'});if(body.action==='ban'){await ref.update({banned:true});return respond(200,{ok:true})}let amount=Number(body.amount);if(!Number.isInteger(amount)||amount<1||amount>500)return respond(400,{ok:false,error:'Grant must be 1-500'});await ref.update({credits:FieldValue.increment(amount)});return respond(200,{ok:true})}
 return respond(400,{ok:false,error:'Unknown action'})
 }catch(err){console.error(err);return respond(400,{ok:false,error:err.message||'Request failed'})}};
