import React,{useEffect,useRef,useState} from 'react';
import {Live} from './generated/Live';import {Fields} from './components/ui';
const R=React.createElement;
export function LiveView({request,user,fields,setField,onError}:any){
 const [rooms,setRooms]=useState<any[]>([]),[active,setActive]=useState(false),[status,setStatus]=useState('Connecting…');
 const video=useRef<HTMLVideoElement>(null),local=useRef<MediaStream|null>(null),room=useRef(''),owner=useRef(''),peers=useRef(new Map<string,RTCPeerConnection>()),queues=useRef(new Map<string,RTCIceCandidateInit[]>()),timer=useRef<any>(null),ice=useRef<any[]>([]),after=useRef(0),selected=useRef(''),polling=useRef(false),alive=useRef(true);
 const post=(url:string,b:any={})=>request(url,{method:'POST',body:JSON.stringify(b)});
 const signal=(to:string,body:any)=>post('/api/live/'+room.current+'/signals',{to,body});
 const close=()=>{
  clearInterval(timer.current);local.current?.getTracks().forEach(t=>t.stop());local.current=null;peers.current.forEach(p=>p.close());peers.current.clear();queues.current.clear();
  if(room.current&&owner.current===user.id)post('/api/live/'+room.current+'/end').catch(()=>{});
  room.current='';setActive(false);
 };
 const peer=(id:string)=>{
  if(peers.current.has(id))return peers.current.get(id)!;
  const p=new RTCPeerConnection({iceServers:ice.current});peers.current.set(id,p);
  p.onicecandidate=e=>{if(e.candidate)signal(id,{candidate:e.candidate.toJSON()}).catch(()=>{})};
  p.ontrack=e=>{if(video.current)video.current.srcObject=e.streams[0]||new MediaStream([e.track])};
  p.onconnectionstatechange=()=>{if(p.connectionState==='connected')setStatus(owner.current===user.id?'You are live':'Connected live');if(p.connectionState==='failed')setStatus('Connection failed. Your server may need TURN for this network.')};
  if(local.current)local.current.getTracks().forEach(t=>p.addTrack(t,local.current!));
  return p;
 };
 const poll=async()=>{
  if(polling.current||!room.current)return;polling.current=true;
  try{
   await post('/api/live/'+room.current+'/heartbeat');
   const events=await request('/api/live/'+room.current+'/signals?after='+after.current);
   for(const e of events){
    if(!room.current||!alive.current)break;after.current=Math.max(after.current,e.id);const p=peer(e.sender),data=e.body;
    if(data.sdp){
     await p.setRemoteDescription(data.sdp);
     for(const c of queues.current.get(e.sender)||[])await p.addIceCandidate(c);queues.current.delete(e.sender);
     if(data.sdp.type==='offer'&&owner.current===user.id){await p.setLocalDescription(await p.createAnswer());await signal(e.sender,{sdp:p.localDescription})}
    }else if(data.candidate){if(p.remoteDescription)await p.addIceCandidate(data.candidate);else queues.current.set(e.sender,[...(queues.current.get(e.sender)||[]),data.candidate])}
   }
  }catch(e:any){setStatus('Live is unavailable: '+e.message)}finally{polling.current=false}
 };
 useEffect(()=>{alive.current=true;request('/api/live').then(setRooms).catch((e:any)=>onError(e.message));const pause=()=>{if(document.hidden&&local.current)close()};document.addEventListener('visibilitychange',pause);return()=>{alive.current=false;close();document.removeEventListener('visibilitychange',pause)}},[]);
 const action=async(name:string)=>{try{
  if(name==='endLive'){close();setRooms(await request('/api/live'));return}
  close();after.current=0;
  if(name==='startLive'){
   const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:720},height:{ideal:1280}},audio:true});if(!alive.current){s.getTracks().forEach(t=>t.stop());return}local.current=s;
   const result=await post('/api/live',{title:fields.liveTitle||'Live with my community'});room.current=result.id;owner.current=user.id;
  }else room.current=selected.current;
  const result=await post('/api/live/'+room.current+'/join');owner.current=result.owner;ice.current=result.iceServers;
  setActive(true);setStatus(owner.current===user.id?'You are live · waiting for viewers':'Connecting…');
  if(local.current){requestAnimationFrame(()=>{if(video.current){video.current.srcObject=local.current;video.current.muted=true;video.current.play().catch(()=>{})}})}
  else{const p=peer(owner.current);p.addTransceiver('video',{direction:'recvonly'});p.addTransceiver('audio',{direction:'recvonly'});await p.setLocalDescription(await p.createOffer());await signal(owner.current,{sdp:p.localDescription})}
  timer.current=setInterval(poll,1800);
 }catch(e:any){close();onError(e.message)}};
 return R(Fields.Provider,{value:{fields,setField,disabled:false,select:(id:string)=>selected.current=id,widgets:{'live-player':R('video',{ref:video,autoPlay:true,playsInline:true,controls:true,className:'editor-video','aria-label':'Live video'})}}},R(Live,{data:{active,status,empty:!rooms.length,rooms:rooms.map(x=>({...x,handle:'@'+x.profile.handle}))},onAction:action}));
}
