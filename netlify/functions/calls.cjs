const {initializeApp,cert,getApps}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getMessaging}=require('firebase-admin/messaging');
const DAILY='https://api.daily.co/v1',DOMAIN='gochi-world',RING_MS=60000,CALL_MS=2*3600*1000;
const respond=(status,body)=>({statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
function init(){if(!getApps().length){if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw Error('Backend not configured');initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))})}return getFirestore()}
async function daily(path,method,body){
 let key=process.env.DAILY_API_KEY;if(!key)throw Error('Calls are not set up yet');
 let r=await fetch(DAILY+path,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 let t=await r.text(),j;try{j=JSON.parse(t)}catch{j={}}
 if(!r.ok)throw Error('Call service error: '+(j.info||j.error||r.status));return j;
}
async function token(call,uid,name,owner){
 let t=await daily('/meeting-tokens','POST',{properties:{room_name:call.dailyRoom,user_name:String(name).slice(0,40),user_id:uid,is_owner:!!owner,exp:Math.floor((call.expAt)/1000),start_video_off:call.kind==='audio',enable_screenshare:false}});
 return `https://${DOMAIN}.daily.co/${call.dailyRoom}?t=${t.token}`;
}
async function push(db,ids,title,body){
 try{
  let docs=(await Promise.all(ids.map(id=>db.collection('users').doc(id).collection('pushTokens').limit(5).get()))).flatMap((s,i)=>s.docs.map(d=>({ref:d.ref,token:d.data().token})));
  for(let i=0;i<docs.length;i+=500){let b=docs.slice(i,i+500);
   let r=await getMessaging().sendEachForMulticast({tokens:b.map(x=>x.token),notification:{title,body},webpush:{fcmOptions:{link:'https://gochi-world.netlify.app/'}}});
   await Promise.all(r.responses.map((x,j)=>!x.success&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(x.error?.code)?b[j].ref.delete():null));
  }
 }catch(e){console.error('call push failed',e)}
}
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return respond(405,{ok:false,error:'POST required'});
 try{
  let db=init(),tk=event.headers.authorization?.replace(/^Bearer /i,'');if(!tk)return respond(401,{ok:false,error:'Sign in first'});
  let uid=(await getAuth().verifyIdToken(tk)).uid,body=JSON.parse(event.body||'{}');
  let userRef=db.collection('users').doc(uid),user=await userRef.get();
  if(!user.exists||user.data().banned)return respond(403,{ok:false,error:'Account unavailable'});
  let me=user.data(),isAdmin=me.role==='admin',act=body.action,now=Date.now();
  const ptr=u=>db.collection('users').doc(u).collection('incomingCalls');
  if(act==='incoming'){
   let s=await ptr(uid).where('ringUntil','>',now).limit(10).get(),out=[];
   for(let d of s.docs){let p=d.data();if(p.dismissed)continue;let c=await db.collection('calls').doc(d.id).get();if(!c.exists||c.data().status==='ended')continue;let g=c.data();out.push({id:d.id,kind:g.kind,from:g.starterName,roomName:g.roomName,ringUntil:p.ringUntil})}
   return respond(200,{ok:true,calls:out});
  }
  if(act==='start'){
   let roomId=String(body.roomId||''),kind=body.kind==='audio'?'audio':'video';
   if(!/^[A-Za-z0-9_-]{1,150}$/.test(roomId))return respond(400,{ok:false,error:'Invalid space'});
   let room=await db.collection('rooms').doc(roomId).get();if(!room.exists)return respond(404,{ok:false,error:'Space not found'});
   let r=room.data(),isPublic=r.type==='public';
   if(isPublic&&!isAdmin)return respond(403,{ok:false,error:'Only the creator can call the whole community. Start a call in a group or message instead.'});
   if(!isPublic&&(!Array.isArray(r.members)||!r.members.includes(uid)))return respond(403,{ok:false,error:'You can only call people in your own chats'});
   let recips=isPublic?(await db.collection('users').where('banned','==',false).get()).docs.map(d=>d.id):r.members;
   recips=[...new Set(recips)].filter(x=>x!==uid).slice(0,50);
   // reuse a live call in this space
   let live=await db.collection('calls').where('roomId','==',roomId).where('status','==','active').limit(5).get();
   let ex=live.docs.find(d=>d.data().expAt>now);
   if(ex){let c=ex.data();if(c.blocked?.includes(uid))return respond(403,{ok:false,error:'You were removed from this call'});return respond(200,{ok:true,callId:ex.id,url:await token(c,uid,me.name,uid===c.starter||isAdmin),kind:c.kind,reused:true})}
   let name='g'+Math.random().toString(36).slice(2,8)+Date.now().toString(36);
   let expAt=now+CALL_MS;
   await daily('/rooms','POST',{name,privacy:'private',properties:{exp:Math.floor(expAt/1000),max_participants:20,enable_prejoin_ui:false,enable_chat:true,enable_screenshare:false,eject_at_room_exp:true,start_video_off:kind==='audio'}});
   let call={roomId,roomName:String(r.name||'Gochi').slice(0,80),starter:uid,starterName:String(me.name).slice(0,40),kind,dailyRoom:name,status:'active',createdAt:now,expAt,recipients:recips,blocked:[]};
   let ref=await db.collection('calls').add(call);
   await Promise.all(recips.map(u=>ptr(u).doc(ref.id).set({ringUntil:now+RING_MS,dismissed:false})));
   push(db,recips,`${me.name} is calling`,`${kind==='audio'?'Audio':'Video'} call in ${call.roomName}. Open Gochi to answer.`);
   return respond(200,{ok:true,callId:ref.id,url:await token(call,uid,me.name,true),kind});
  }
  let id=String(body.callId||'');if(!/^[A-Za-z0-9]{10,40}$/.test(id))return respond(400,{ok:false,error:'Bad call'});
  let cref=db.collection('calls').doc(id),cs=await cref.get();if(!cs.exists)return respond(404,{ok:false,error:'Call not found'});
  let c=cs.data(),owner=uid===c.starter||isAdmin;
  if(act==='join'){
   if(c.status==='ended'||c.expAt<=now)return respond(400,{ok:false,error:'This call has ended'});
   if(c.blocked?.includes(uid))return respond(403,{ok:false,error:'You were removed from this call'});
   if(uid!==c.starter&&!c.recipients.includes(uid)&&!isAdmin)return respond(403,{ok:false,error:'You were not invited to this call'});
   await ptr(uid).doc(id).set({dismissed:true,ringUntil:0},{merge:true});
   return respond(200,{ok:true,url:await token(c,uid,me.name,owner),kind:c.kind});
  }
  if(act==='decline'){await ptr(uid).doc(id).set({dismissed:true,ringUntil:0},{merge:true});return respond(200,{ok:true})}
  if(act==='end'){
   if(!owner)return respond(403,{ok:false,error:'Only the person who started the call can end it'});
   await cref.update({status:'ended'});try{await daily('/rooms/'+c.dailyRoom,'DELETE')}catch(e){console.error(e)}
   await Promise.all(c.recipients.map(u=>ptr(u).doc(id).set({dismissed:true,ringUntil:0},{merge:true})));
   return respond(200,{ok:true});
  }
  if(act==='block'){
   if(!owner)return respond(403,{ok:false,error:'Only the person who started the call can remove people'});
   let target=String(body.uid||'');if(!c.recipients.includes(target)||target===c.starter)return respond(400,{ok:false,error:'Pick someone else on the call'});
   await cref.update({blocked:FieldValue.arrayUnion(target)});
   try{await daily('/rooms/'+c.dailyRoom+'/eject','POST',{user_ids:[target]})}catch(e){console.error(e)}
   return respond(200,{ok:true});
  }
  return respond(400,{ok:false,error:'Unknown action'});
 }catch(err){console.error(err);return respond(400,{ok:false,error:err.message||'Request failed'})}
};
