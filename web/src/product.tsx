import fixWebmDuration from 'fix-webm-duration';
import React,{useEffect,useRef,useState} from 'react';
import {Fields} from './components/ui';
import {Feed} from './generated/Feed';import {Editor} from './generated/Editor';import {Browse} from './generated/Browse';import {Profile} from './generated/Profile';import {Inbox} from './generated/Inbox';import {Sheet} from './generated/Sheet';import {Settings} from './generated/Settings';
import {SelectMedia} from './generated/SelectMedia';import {UploadPreview} from './generated/UploadPreview';import {PostDetails} from './generated/PostDetails';
import {LiveView} from './live';
import {Player,Preview,MediaThumbnail,PhotoPlayer} from './player';import {base} from './main';import {deviceDraft} from './drafts';
const R=React.createElement;
type DraftClip={key:string,name:string,file?:File,media?:string,start:number,end:number,speed:number,filter:string,flip:boolean,duration:number,photo?:boolean,thumbnail?:string};
const initialFields={sound:'',soundStart:0,soundVolume:.5,originalVolume:1,textStart:0,textEnd:3,textSize:36,textX:.5,textY:.7,visibility:'public',allowComments:true,allowRemix:false,caption:'',location:'',alt:'',coverTime:0,recordAudio:false};
const requestId=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
const json=(body:any)=>({method:'POST',body:JSON.stringify(body)});
const date=(v:number)=>new Date(v*1000).toLocaleString();
const title=(p:any)=>p?.handle?'@'+p.handle:'Member';
const initials=(p:any)=>(p?.name||p?.handle||'M').slice(0,2).toUpperCase();
// Decode one local file at a time, then release the decoder. Gallery tiles use
// small stills instead of keeping up to twenty video decoders alive on a phone.
const inspectVideo=(file:File)=>new Promise<{duration:number,thumbnail:string}>((resolve,reject)=>{
 const video=document.createElement('video'),url=URL.createObjectURL(file);let duration=0,finished=false;
 const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);let thumbnail='';
  if(!error){try{const canvas=document.createElement('canvas');canvas.width=240;canvas.height=Math.round(240*video.videoHeight/video.videoWidth);if(canvas.height>480){canvas.height=480;canvas.width=Math.round(480*video.videoWidth/video.videoHeight)};canvas.getContext('2d')!.drawImage(video,0,0,canvas.width,canvas.height);thumbnail=canvas.toDataURL('image/jpeg',.7)}catch{}}
  video.removeAttribute('src');video.load();URL.revokeObjectURL(url);if(error)reject(error);else resolve({duration,thumbnail});
 };
 const timer=setTimeout(()=>finish(Error('Could not read video. Try a different MP4 or WebM file.')),10000);
 video.preload='auto';video.muted=true;video.onloadedmetadata=()=>{duration=video.duration;if(!Number.isFinite(duration)||duration<=0||duration>600){finish(Error('Choose a video up to 10 minutes'));return}video.currentTime=Math.min(.1,duration/2)};
 video.onseeked=()=>finish();video.onerror=()=>finish(Error('This video format is not supported'));video.src=url;
});
export function Product(p:any){
 const {user,cfg,request,fields,setField:sf,selected,setError,setNotice,setBusy,common}=p;
 const route=(p.route||'#home').slice(1),path=route.split('/')[0],arg=route.slice(path.length+1);
 const [boot,setBoot]=useState<any>({}),[posts,setPosts]=useState<any[]>([]),[people,setPeople]=useState<any[]>([]),[profile,setProfile]=useState<any>({}),[events,setEvents]=useState<any[]>([]),[messages,setMessages]=useState<any[]>([]),[peer,setPeer]=useState(''),[relations,setRelations]=useState<any[]>([]),[reports,setReports]=useState<any[]>([]);
 const [sheet,setSheet]=useState(''),[focused,setFocused]=useState<any>(null),[comments,setComments]=useState<any[]>([]),[sounds,setSounds]=useState<any[]>([]),[music,setMusic]=useState<any[]>([]);
 const [clips,setClips]=useState<DraftClip[]>([]),[clipIndex,setClipIndex]=useState(0),[overlays,setOverlays]=useState<any[]>([]),[rendered,setRendered]=useState(''),[renderStatus,setRenderStatus]=useState(''),[job,setJob]=useState<any>(null),[voice,setVoice]=useState(''),[remix,setRemix]=useState<any>(null);
 const [library,setLibrary]=useState<DraftClip[]>([]),[mediaTab,setMediaTab]=useState('all');
 const step=arg||'select',submitting=useRef(false),prepared=useRef<string[]>([]),pendingJob=useRef<any>(null),routeRef=useRef(route);routeRef.current=route;
 const [recording,setRecording]=useState(false),[recordStatus,setRecordStatus]=useState(''),[offline,setOffline]=useState(!navigator.onLine);
 const camera=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),recordTimer=useRef<any>(null),facing=useRef('user'),alive=useRef(true),loadVersion=useRef(0),defaults=useRef(false),publishKey=useRef(requestId()),recordTarget=useRef('video');
 const stopCamera=()=>{if(recorder.current?.state!=='inactive')recorder.current?.stop();stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;clearTimeout(recordTimer.current)};
 const load=async()=>{
  const version=++loadVersion.current;
  const data=await request('/api/clips');if(!alive.current||version!==loadVersion.current)return;setBoot(data);
  if(path==='live')return;
  if(path==='create'){setSounds(await request('/api/sounds'));return}
  if(path==='settings'){
   const pr=data.profile,prefs=await request('/api/preferences');if(version!==loadVersion.current)return;
   for(const [k,v] of Object.entries({...pr,...prefs,...playback()}))sf(k,v);
   setRelations(await request('/api/relations'));if(user.role==='owner')setReports(await request('/api/moderation'));return;
  }
  if(path==='inbox'){setEvents(await request('/api/notifications'));setMessages(await request('/api/messages'+(peer?'?with='+peer:'')));return}
  if(path==='profile'){
   const id=arg||user.id;const [pr,ps]=await Promise.all([request('/api/profiles/'+id),request('/api/discover?owner='+id)]);if(version!==loadVersion.current)return;setProfile(pr);setPosts(ps.items||ps);return;
  }
  if(path==='watch'){const post=await request('/api/posts/'+arg);if(version===loadVersion.current)setPosts([post]);return}
  const mode=path==='home'?'for-you':path;
  const ps=await request(path==='studio'?'/api/feed?mode=studio':'/api/discover?mode='+encodeURIComponent(mode)+'&q='+encodeURIComponent(path==='explore'?fields.query||'':''));
  if(version!==loadVersion.current)return;setPosts(ps.items||ps);
  if(path==='explore')setPeople(await request('/api/profiles?q='+encodeURIComponent(fields.query||'')));
 };
 useEffect(()=>{alive.current=true;const change=()=>setOffline(!navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);const pause=()=>{if(document.hidden)stopCamera()};document.addEventListener('visibilitychange',pause);
  if(!defaults.current){Object.entries(initialFields).forEach(([k,v])=>sf(k,v));defaults.current=true}
  deviceDraft(user.id).catch(()=>{});
  const activity=new EventSource(base+'/api/events');activity.addEventListener('activity',ev=>{try{const rows=JSON.parse((ev as MessageEvent).data);if(alive.current)setEvents(rows)}catch{}});
  return()=>{alive.current=false;loadVersion.current++;activity.close();stopCamera();window.removeEventListener('online',change);window.removeEventListener('offline',change);document.removeEventListener('visibilitychange',pause)}
 },[]);
 useEffect(()=>{setError('');load().catch((e:any)=>setError(e.message));if(path!=='create')stopCamera()},[path,arg,peer]);
 useEffect(()=>{if(!fields.files?.length)return;const chosen=fields.files;sf('files',[]);addFiles(chosen).catch(e=>setError(e.message))},[fields.files]);
 const playback=()=>{try{return JSON.parse(localStorage.getItem('my-clips-playback')||'{}')}catch{return {}}};
 const selectClip=(index:number,items=clips)=>{setClipIndex(index);const c=items[index];if(!c)return;Object.entries({trimStart:c.start,trimEnd:c.end,speed:String(c.speed),filter:c.filter,flip:c.flip}).forEach(([k,v])=>sf(k,v))};
 const invalidate=()=>{setRendered('');prepared.current=[];pendingJob.current=null;setJob(null);sf('coverTime',0);setRenderStatus('');publishKey.current=requestId()};
 const addFiles=async(files:File[])=>{
  if(clips.length+files.length>10)throw Error('Choose up to 10 clips');
  const next=[...clips];
  for(const file of files){
   if(file.size>100*1024*1024)throw Error('Each clip must be under 100 MiB');
   const photo=file.type.startsWith('image/');
   const {duration,thumbnail}=photo?{duration:3,thumbnail:''}:await inspectVideo(file);
   next.push({key:crypto.randomUUID(),name:file.name,file,start:0,end:duration,speed:1,filter:'none',flip:false,duration,photo,thumbnail});
  }
  if(!alive.current)return;if(next.some(c=>c.photo)&&next.some(c=>!c.photo))throw Error('Choose photos or videos for one upload. Your current selection is unchanged.');setClips(next);setLibrary(xs=>[...xs,...next.slice(clips.length)]);selectClip(0,next);invalidate();
 };
 const uploadAudio=async(file:File,name:string)=>{
  const form=new FormData();form.append('audio',file);form.append('title',name);form.append('rights','confirmed');
  const audio=await request('/api/sounds',{method:'POST',body:form});setSounds(await request('/api/sounds'));return audio.id;
 };
 const openCamera=async(audioOnly=false)=>{
  stopCamera();recordTarget.current=audioOnly?'voice':'video';const media=await navigator.mediaDevices.getUserMedia({video:audioOnly?false:{facingMode:facing.current,width:{ideal:720},height:{ideal:1280}},audio:audioOnly||!!fields.recordAudio});
  if(!alive.current){media.getTracks().forEach(t=>t.stop());return}
  stream.current=media;if(camera.current){camera.current.srcObject=media;await camera.current.play()}setRecordStatus('Ready');
 };
 const startRecord=async(audioOnly=false)=>{
  if(audioOnly||!stream.current)await openCamera(audioOnly);if(!stream.current)return;
  const types=audioOnly?['audio/webm;codecs=opus','audio/webm']:['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'];
  const mime=types.find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('Recording is unavailable in this browser');
  const rec=new MediaRecorder(stream.current,{mimeType:mime,videoBitsPerSecond:2500000}),chunks:Blob[]=[];recorder.current=rec;let runningSince=performance.now(),elapsed=0;rec.onpause=()=>{elapsed+=performance.now()-runningSince};rec.onresume=()=>{runningSince=performance.now()};
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=async()=>{clearTimeout(recordTimer.current);setRecording(false);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(!alive.current)return;let blob=new Blob(chunks,{type:mime});if(mime.includes('webm'))blob=await new Promise<Blob>(resolve=>fixWebmDuration(blob,elapsed+performance.now()-runningSince,resolve,{logger:false}));const file=new File([blob],audioOnly?'voiceover.webm':mime.includes('mp4')?'camera.mp4':'camera.webm',{type:mime});try{if(audioOnly){setBusy('Saving voiceover…');setVoice(await uploadAudio(file,'My voiceover'));invalidate()}else await addFiles([file]);setSheet('')}catch(e:any){setError(e.message)}finally{setBusy('')}};
  rec.start(500);setRecording(true);setRecordStatus(audioOnly?'Recording voiceover…':'Recording · up to 60 seconds');recordTimer.current=setTimeout(()=>rec.state!=='inactive'&&rec.stop(),60000);
 };
 const buildEDL=(items:DraftClip[])=>({clips:items.map(c=>({media:c.media,start:c.start,end:c.end,speed:c.speed,filter:c.filter,flip:c.flip})),mute:false,quality:'standard',coverTime:Number(fields.coverTime||0),sound:fields.sound||'',soundStart:Number(fields.soundStart||0),soundVolume:Number(fields.soundVolume??.5),originalVolume:Number(fields.originalVolume??1),voice,voiceVolume:1,text:overlays,remix:remix?.id||'',remixMode:remix?.mode||''});
 const act=async(action:string)=>{
  setError('');const id=selected.current;
  try{
   if(action==='create'){location.hash='create/select';return}
   if(['selectMedia','previewMedia','postDetails','storyDetails','doneEditing'].includes(action)){
    if(action!=='selectMedia'&&action!=='doneEditing'&&!clips.length)throw Error('Choose media first');
    if(action==='storyDetails')sf('postKind','story');else if(action==='postDetails')sf('postKind','reel');
    await saveDraft();location.hash='create/'+(action==='selectMedia'||(action==='doneEditing'&&!clips.length)?'select':action==='postDetails'||action==='storyDetails'?'post':'preview');return;
   }
   if(action==='openEditor'||action==='createText'||action==='editSound'||action==='editText'||action==='editStyle'){
    if(clips.some(c=>c.photo))throw Error('Photos can be posted directly. Choose videos to use the video editor.');
    location.hash='create/edit';return;
   }
   if(action==='mediaTab'){setMediaTab(id);return}
   if(action==='mediaSource'){setSheet('source');return}
   if(action==='toggleMedia'){
    const c=library.find(x=>x.key===id);if(!c)return;const next=clips.some(x=>x.key===id)?clips.filter(x=>x.key!==id):[...clips,c];
    if(next.length>10)throw Error('Choose up to 10 items');if(next.some(x=>x.photo)&&next.some(x=>!x.photo))throw Error('Choose photos or videos for one upload');
    setClips(next);selectClip(0,next);invalidate();return;
   }
   if(action==='hashtag'||action==='mention'){sf('caption',(fields.caption||'')+(fields.caption?' ':'')+(action==='hashtag'?'#':'@'));document.querySelector<HTMLTextAreaElement>('[name="caption"]')?.focus();return}
   if(['locationOptions','audienceOptions','privacyOptions','moreOptions','shareOptions','linkOptions','coverOptions'].includes(action)){setSheet(action);return}
   if(action==='addLink'){let url;try{url=new URL(fields.postLink)}catch{throw Error('Enter a complete https:// link')};if(url.protocol!=='https:')throw Error('Use an https:// link');sf('caption',((fields.caption||'')+' '+url.href).trim());setSheet('');return}

   if(action==='closeEditor'){await saveDraft();location.hash='home';return}
   if(action==='search'){sf('query',fields.search||'');location.hash='explore';return}
   if(action==='doSearch'){await load();return}
   if(action==='profile'){location.hash='profile/'+id;return}
   if(action==='like'||action==='save'){const post=posts.find(x=>x.id===id);if(!post)return;await request('/api/posts/'+id+'/'+action,json({enabled:action==='like'?!post.liked:!post.saved}));setPosts(xs=>xs.map(x=>x.id===id?{...x,liked:action==='like'?!x.liked:x.liked,saved:action==='save'?!x.saved:x.saved,likes:x.likes+(action==='like'?(x.liked?-1:1):0)}:x));return}
   if(action==='comments'){const post=posts.find(x=>x.id===id);setFocused(post);setComments(await request('/api/posts/'+id+'/comments'));setSheet('comments');return}
   if(action==='sendComment'){await request('/api/posts/'+focused.id+'/comments',json({body:fields.comment}));sf('comment','');setComments(await request('/api/posts/'+focused.id+'/comments'));return}
   if(action==='more'){setFocused(posts.find(x=>x.id===id));setSheet('more');return}
   if(action==='share'){const url=location.origin+base+'/#watch/'+id;if(navigator.share)await navigator.share({title:'My Clips',url});else{await navigator.clipboard.writeText(url);setNotice('Link copied')}return}
   if(action==='closeSheet'){stopCamera();setSheet('');return}
   if(action==='hideClip'){await request('/api/posts/'+focused.id+'/signal',json({event:crypto.randomUUID(),seconds:0,duration:1,hidden:true}));setPosts(xs=>xs.filter(x=>x.id!==focused.id));setSheet('');return}
   if(action==='duet'||action==='stitch'){const options=await request('/api/posts/'+focused.id+'/options');if(!options.remix)throw Error('This creator has not enabled remixing');setRemix({id:focused.id,mode:action,handle:title(focused.profile)});invalidate();setSheet('');location.hash='create';return}
   if(action==='report'){await request('/api/reports',json({post:focused.id,reason:fields.reportReason||''}));setSheet('');setNotice('Report sent to your server moderator');return}
   if(action==='archive'||action==='deleteClip'){await request('/api/posts/'+focused.id+'/'+(action==='archive'?'archive':'delete'),json({}));setSheet('');await load();return}
   if(action==='follow'){const target=people.find(x=>x.id===id)||profile;await request('/api/profiles/'+id+'/relations',json({kind:'follow',enabled:!target.followingState}));await load();return}
   if(action==='block'){await request('/api/profiles/'+id+'/relations',json({kind:'block',enabled:true}));location.hash='home';return}
   if(action==='selectClip'){selectClip(clips.findIndex(c=>c.key===id));return}
   if(action==='applyClip'){const start=Number(fields.trimStart),end=Number(fields.trimEnd),speed=Number(fields.speed);if(!clips[clipIndex]||start<0||end<=start||end>clips[clipIndex].duration||speed<.5||speed>2)throw Error('Check clip start, end and speed');setClips(xs=>xs.map((x,i)=>i===clipIndex?{...x,start,end,speed,filter:fields.filter||'none',flip:!!fields.flip}:x));invalidate();return}
   if(action==='removeClip'){const next=clips.filter(x=>x.key!==id);setClips(next);selectClip(Math.max(0,Math.min(clipIndex,next.length-1)),next);invalidate();return}
   if(action==='clipUp'){const next=[...clips],i=next.findIndex(x=>x.key===id);if(i>0){[next[i-1],next[i]]=[next[i],next[i-1]];setClips(next);selectClip(i-1,next);invalidate()}return}
   if(action==='addText'){const text=String(fields.overlayText||'').trim();if(!text)throw Error('Write some text first');setOverlays(xs=>[...xs,{text,start:Number(fields.textStart),end:Number(fields.textEnd),x:Number(fields.textX),y:Number(fields.textY),size:Number(fields.textSize)}]);sf('overlayText','');invalidate();return}
   if(action==='removeText'){setOverlays(xs=>xs.filter((_x,i)=>String(i)!==id));invalidate();return}
   if(action==='saveDraft'){setBusy('Saving device draft…');await saveDraft();setNotice('Private device draft saved');return}
   if(action==='restoreDraft'){const d=await deviceDraft(user.id);if(!d)throw Error('No device draft yet');setClips(d.clips||[]);setLibrary(d.library||d.clips||[]);setOverlays(d.overlays||[]);setVoice(d.voice||'');setRemix(d.remix||null);Object.entries(d.fields||{}).forEach(([k,v])=>sf(k,v));selectClip(0,d.clips||[]);prepared.current=d.prepared||[];pendingJob.current=d.pendingJob||null;publishKey.current=d.requestKey||requestId();setRendered(d.rendered||(!d.clips?.[0]?.photo&&d.prepared?.[0])||'');setRenderStatus('');location.hash='create/select';return}
   if(action==='renderClip'||action==='publishClip'){
    if(submitting.current)return;submitting.current=true;
    try{
     if(!clips.length)throw Error('Choose media first');
     if(!clips[0].photo&&clips.reduce((n,c)=>n+(c.end-c.start)/c.speed,0)>180)throw Error('Your video is over 3 minutes. Open Edit / Create to trim it before posting.');
     const caption=String(fields.caption||'');if(caption.length>2200)throw Error('Keep your description within 2,200 characters');
     if(fields.publishAt&&!Number.isFinite(new Date(fields.publishAt).getTime()))throw Error('Choose a valid schedule');
     const target=routeRef.current;
     const next=[...clips];
     setBusy('Uploading…');
     for(let i=0;i<next.length;i++){
      if(next[i].media)continue;
      setBusy('Uploading '+(i+1)+' of '+next.length+'…');
      const form=new FormData();form.append('original',next[i].file!);form.append('kind',next[i].photo?'posts':'reels');
      const m=await request('/api/media',{method:'POST',body:form});next[i]={...next[i],media:m.id};setClips([...next]);await saveDraft(next);
     }
     if(!prepared.current.length){
      if(next[0].photo)prepared.current=next.map(c=>c.media!);
      else{
       const current=pendingJob.current||await request('/api/jobs',json(buildEDL(next)));pendingJob.current=current;setJob(current);await saveDraft(next);
       for(;;){
        if(!alive.current)throw Error('Preparation paused. Reopen your draft to continue.');
        const rows=await request('/api/jobs'),j=rows.find((x:any)=>x.id===current.id);
        if(!j){pendingJob.current=null;throw Error('Preparation could not be found. Post again to retry.');}
        setRenderStatus('Preparing your video · '+j.progress+'%');setBusy('Preparing your video · '+j.progress+'%');
        if(j.state==='failed'){pendingJob.current=null;setJob(null);await saveDraft(next);throw Error(j.error)}
        if(j.state==='complete'){prepared.current=[j.media];setRendered(j.media);pendingJob.current=null;setJob(null);await saveDraft(next);break}
        await new Promise(resolve=>setTimeout(resolve,1200));
       }
      }
     }
     if(action==='renderClip'){setRenderStatus('Edits ready to preview');return}
     if(routeRef.current!==target)throw Error('Your video is prepared. Return to Post to publish it.');
     setBusy('Posting…');
     const post=await request('/api/posts',json({kind:fields.postKind==='story'?'story':next[0].photo?'post':'reel',media:prepared.current,caption,alt:fields.alt||'',location:fields.location||'',visibility:fields.visibility||'public',comments:!!fields.allowComments,remix:!!fields.allowRemix,requestKey:publishKey.current,publishAt:fields.publishAt?Math.floor(new Date(fields.publishAt).getTime()/1000):0}));
     setNotice(post.state==='scheduled'?'Clip scheduled':post.kind==='story'?'Your story is live':'Your clip is live');await deviceDraft(user.id,null);
     setClips([]);setLibrary([]);setOverlays([]);setRendered('');setVoice('');setRemix(null);prepared.current=[];pendingJob.current=null;publishKey.current=requestId();Object.entries(initialFields).forEach(([k,v])=>sf(k,v));sf('publishAt','');sf('postKind','reel');
     location.hash=post.state==='scheduled'?'studio':post.kind==='story'?'profile':'watch/'+post.id;return;
    }finally{submitting.current=false}
   }
   if(action==='music'){setSheet('music');return}
   if(action==='searchMusic'){const res=await fetch('/music/search/?itemtype=tracks&q='+encodeURIComponent(fields.musicQuery||'')+'&limit=30&start=0',{credentials:'same-origin'});if(!res.ok||!res.headers.get('Content-Type')?.includes('json'))throw Error('Open My Music and sign in, then search again');const data=await res.json();setMusic((data.results||[]).map((x:any,i:number)=>({...x,key:String(i),artist:Array.isArray(x.artists)?x.artists.map((a:any)=>a.name||a).join(', '):x.artist||''})));return}
   if(action==='chooseMusic'){if(!fields.audioRights)throw Error('Confirm permission to use this music');const track=music[Number(id)];if(!track)throw Error('Choose a track');setBusy('Importing your selected My Music sound…');const res=await fetch('/music/file/'+encodeURIComponent(track.trackhash)+'/legacy?filepath='+encodeURIComponent(track.filepath),{credentials:'same-origin'});if(!res.ok)throw Error('My Music could not provide this track');const blob=await res.blob();if(blob.size>30*1024*1024)throw Error('Choose audio under 30 MiB');const ext=String(track.filepath).split('.').pop()||'mp3';sf('sound',await uploadAudio(new File([blob],'music.'+ext,{type:blob.type}),track.title));invalidate();setSheet('');return}
   if(action==='importAudio'){if(!fields.audioRights||!fields.audioFile?.[0])throw Error('Choose audio and confirm permission');setBusy('Importing sound…');sf('sound',await uploadAudio(fields.audioFile[0],fields.audioFile[0].name));invalidate();return}
   if(action==='record'){setSheet('camera');setRecordStatus('Enable your camera when ready');return}
   if(action==='voiceover'){setSheet('voice');setRecordStatus('Microphone access starts when you record');return}
   if(action==='startCamera'){await openCamera();return}
   if(action==='switchCamera'){if(recording)throw Error('Finish recording before switching cameras');facing.current=facing.current==='user'?'environment':'user';await openCamera();return}
   if(action==='startRecording'){await startRecord();return}
   if(action==='startVoice'){await startRecord(true);return}
   if(action==='pauseRecording'){const r=recorder.current;if(r?.state==='recording'){r.pause();setRecordStatus('Paused')}else if(r?.state==='paused'){r.resume();setRecordStatus('Recording…')}return}
   if(action==='stopRecording'){recorder.current?.stop();return}
   if(action==='readAll'){await request('/api/notifications/read',json({}));setEvents(xs=>xs.map(x=>({...x,seen:true})));return}
   if(action==='openEvent'){const e=events.find(x=>x.object===id);location.hash=e?.category==='message'?'inbox':'watch/'+id;return}
   if(action==='message'){setPeer(id);location.hash='inbox';return}
   if(action==='sendMessage'){await request('/api/messages',json({to:peer,body:fields.message,requestKey:crypto.randomUUID()}));sf('message','');setMessages(await request('/api/messages?with='+peer));return}
   if(action==='profileSave'){await request('/api/profile',{method:'PATCH',body:JSON.stringify({handle:fields.handle,bio:fields.bio,private:!!fields.private,links:[]})});setNotice('Profile saved');return}
   if(action==='resetFeed'){await request('/api/feed/reset',json({}));setNotice('Recommendations reset');return}
   if(action==='savePlayback'){localStorage.setItem('my-clips-playback',JSON.stringify({quality:fields.quality||'auto',dataSaver:!!fields.dataSaver}));setNotice('Playback preferences saved');return}
   if(action==='pushSave'){await savePush();return}
   if(action==='testPush'){await request('/api/push/test',json({}));setNotice('Test notification queued');return}
   if(action==='approve'||action==='reject'){await request('/api/profiles/'+id+'/relations',json({kind:action,enabled:true}));await load();return}
   if(action==='removeReport'||action==='dismissReport'){await request('/api/moderation/'+id,json({action:action==='removeReport'?'remove':'dismiss'}));await load();return}
   if(action==='export'){await p.download(await request('/api/export'),'my-clips-export.zip');return}
   if(action==='install'){const prompt=(window as any).myClipsInstall;if(prompt)await prompt.prompt();else setNotice('Use your browser’s Install app or Add to Home Screen option. The Android APK is also available with the release.');return}
   if(action==='updateApp'){const sw=await navigator.serviceWorker.getRegistration();await sw?.update();location.reload();return}
   if(action==='deleteAccount'){await request('/api/account/delete',json({confirmation:fields.deleteConfirmation||''}));await deviceDraft(user.id,null);location.reload();return}
   await common(action);
  }catch(e:any){if(e.name!=='AbortError')setError(e.message)}finally{setBusy('')}
 };
 const saveDraft=async(items=clips)=>{const saved:any={};for(const k of Object.keys(initialFields).concat(['publishAt','postKind']))saved[k]=fields[k];await deviceDraft(user.id,{clips:items,library,overlays,voice,remix,fields:saved,prepared:prepared.current,pendingJob:pendingJob.current,rendered,requestKey:publishKey.current})};
 const savePush=async()=>{
  if(fields.push){
   if(!('Notification' in window)||!('serviceWorker' in navigator)||!boot.pushKey)throw Error('Push is unavailable in this browser or server');
   if(await Notification.requestPermission()!=='granted')throw Error('Notification permission was not granted');
   const sw=await navigator.serviceWorker.ready;const key=Uint8Array.from(atob(boot.pushKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   const sub=await sw.pushManager.getSubscription()||await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   await request('/api/push/subscribe',json(sub.toJSON()));
  }else {const sub=await(await navigator.serviceWorker.ready).pushManager.getSubscription();if(sub){await request('/api/push/subscribe',{method:'DELETE',body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe()}}
  await request('/api/preferences',{method:'PUT',body:JSON.stringify({push:!!fields.push,quietStart:fields.quietStart||'',quietEnd:fields.quietEnd||''})});setNotice('Notification preferences saved');
 };
 const postData=posts.map(x=>({...x,handle:title(x.profile),initials:initials(x.profile),profileURL:'#profile/'+x.owner,href:'#watch/'+x.id,poster:x.mediaTypes?.[0]?.startsWith('image/')?base+'/api/media/'+x.media[0]:base+'/api/stream/'+x.media[0]+'/poster.jpg',likeClass:x.liked?'round-action liked':'round-action',saveClass:x.saved?'round-action saved':'round-action',soundLabel:'♫ '+(x.soundName||'Original sound'),reason:x.reason||'From this community'}));
 const total=clips.reduce((n,c)=>n+(c.end-c.start)/c.speed,0);
 const selectedClip=clips[clipIndex];
 const actionSelect=(id:string)=>{selected.current=id};
 let coverOffset=Number(fields.coverTime||0),coverClip=clips[0];for(const c of clips){const d=(c.end-c.start)/c.speed;if(coverOffset<d){coverClip=c;break}coverOffset-=d}
 const widgets:any={'cover-preview':R(MediaThumbnail,{clip:coverClip,time:coverClip?coverClip.start+coverOffset*coverClip.speed:0,large:true}),'media-thumbnail':(item:any)=>R(MediaThumbnail,{clip:item,time:Number(fields.coverTime||0)}),'feed-player':(item:any)=>item.mediaTypes?.[0]?.startsWith('image/')?R(PhotoPlayer,{post:item}):R(Player,{post:item,request,...playback(),onLike:()=>{selected.current=item.id;act('like')}}),'editor-preview':R(Preview,{file:rendered?undefined:selectedClip?.file,url:rendered?base+'/api/stream/'+rendered+'/video.mp4':selectedClip?.media?base+'/api/media/'+selectedClip.media+'?original=1':'',photo:selectedClip?.photo,start:rendered?0:selectedClip?.start,end:rendered?undefined:selectedClip?.end,speed:rendered?1:selectedClip?.speed,filter:rendered?'none':selectedClip?.filter,flip:!rendered&&selectedClip?.flip}),'sound-preview':fields.sound?R('audio',{controls:true,src:base+'/api/sounds/'+encodeURIComponent(fields.sound),preload:'none','aria-label':'Sound preview'}):null,'camera-preview':R('video',{ref:camera,muted:true,playsInline:true,className:'camera-preview','aria-label':'Camera preview'})};
 let content:any;
 const data:any={posts:postData,empty:posts.length===0,hasPosts:!!posts.length,homeClass:path==='home'?'active':'',followingClass:path==='following'?'active':'',friendsClass:path==='friends'?'active':''};
 if(path==='live'){
  content=R(LiveView,{request,user,fields,setField:sf,onError:setError});
 }else if(path==='create'){
  const clipRows=clips.map((c,i)=>({...c,variant:i===clipIndex?'preview-thumb-selected':'preview-thumb',removeLabel:'Remove '+c.name,durationLabel:c.photo?'':Math.floor((c.end-c.start)/c.speed/60)+':'+String(Math.floor((c.end-c.start)/c.speed%60)).padStart(2,'0')}));
  const audiences=[{value:'public',label:'Everyone on this server'},{value:'followers',label:'Followers'},{value:'private',label:'Only me'}];
  const flowData={...data,workspace:cfg.workspace,clips:clipRows,cover:selectedClip||clips[0],noClips:!clips.length,nextLabel:'Next ('+clips.length+')',video:!clips[0]?.photo,multiple:clips.length>1,edited:!!(overlays.length||voice||remix||fields.sound||clips.some(c=>c.filter!=='none'||c.flip||c.start>0||c.end!==c.duration||c.speed!==1)),audienceLabel:fields.visibility==='private'?'Only you can view this post':fields.visibility==='followers'?'Followers can view this post':'Everyone can view this post',locationLabel:fields.location||'',scheduleLabel:fields.publishAt?'Scheduled':'',kindLabel:fields.postKind==='story'?'Your Story':'',postLabel:fields.publishAt?'Schedule':'Post',renderStatus};
  if(step==='preview')content=R(UploadPreview,{data:flowData,onAction:act});
  else if(step==='post')content=R(PostDetails,{data:flowData,onAction:act});
  else if(step!=='edit')content=R(SelectMedia,{data:{...flowData,tabs:[['all','All'],['videos','Videos'],['photos','Photos']].map(([id,title])=>({id,title,active:mediaTab===id,variant:mediaTab===id?'media-tab-active':'media-tab'})),hasLibrary:!!library.length,emptyLibrary:!library.length,library:library.filter(c=>mediaTab==='all'||(mediaTab==='photos'?c.photo:!c.photo)).map(c=>{const i=clips.findIndex(x=>x.key===c.key);return{...c,picked:i>=0,variant:i>=0?'media-cell-selected':'media-cell',label:(i>=0?'Deselect ':'Select ')+c.name,number:i>=0?String(i+1):'',durationLabel:c.photo?'':Math.floor(c.duration/60)+':'+String(Math.floor(c.duration%60)).padStart(2,'0')}})},onAction:act});
  else content=R(Editor,{data:{...data,clips:clips.map((c,i)=>({...c,variant:i===clipIndex?'selected':'secondary',durationLabel:((c.end-c.start)/c.speed).toFixed(1)+'s'})),noClips:!clips.length,overlays:overlays.map((t,i)=>({...t,key:String(i),label:t.text+' · '+t.start+'–'+t.end+'s'})),durationLabel:total.toFixed(1)+' / 180s',speeds:[{value:'.5',label:'0.5×'},{value:'1',label:'1×'},{value:'1.5',label:'1.5×'},{value:'2',label:'2×'}],filters:['none','vivid','warm','cool','mono','vintage','glow'],soundOptions:[{value:'',label:'Original sound'},...sounds.map(x=>({value:x.id,label:x.name+' · '+(x.artist||'Your audio')}))],audiences:[{value:'public',label:'Everyone on this server'},{value:'followers',label:'Followers'},{value:'private',label:'Only me'}],cannotPublish:!rendered||!!job,renderStatus,remixLabel:remix?(remix.mode==='duet'?'Duet with ':'Stitch from ')+remix.handle:'',voiceLabel:voice?'Voiceover added':''},onAction:act});
 }else if(path==='explore'||path==='saved'||path==='studio'){
  content=R(Browse,{data:{...data,title:path==='saved'?'Saved clips':path==='studio'?'Creator studio':'Explore',people:people.map(x=>({...x,handle:title(x),initials:initials(x),href:'#profile/'+x.id,followLabel:x.followingState==='accepted'?'Following':x.followingState==='pending'?'Requested':'Follow'}))},onAction:act});
 }else if(path==='profile'){
  content=R(Profile,{data:{...data,own:profile.id===user.id,profileID:profile.id,initials:initials(profile),handle:title(profile),name:profile.name,bio:profile.bio,followingText:(profile.following||0)+' Following',followersText:(profile.followers||0)+' Followers',postsText:(profile.posts||0)+' Clips',followLabel:profile.followingState?'Following':'Follow'},onAction:act});
 }else if(path==='inbox'){
  const peers=new Map();messages.forEach(x=>{const other=x.sender===user.id?x.recipient:x.sender;if(!peers.has(other))peers.set(other,{peer:other,label:(x.sender===user.id?'You':title(x.profile))+': '+x.body})});
  content=R(Inbox,{data:{events:events.map(x=>({...x,icon:x.category==='like'?'Heart':x.category==='message'?'Send':x.category==='comment'?'MessageCircle':'Bell',label:x.category==='message'?'You have a new message':x.category==='like'?'Someone liked your clip':x.category==='comment'?'New comment on your clip':x.category==='follow'?'A new follower':'New activity',date:date(x.created)})),conversations:[...peers.values()],conversation:!!peer,conversationTitle:'Conversation',messages:[...messages].reverse().filter(x=>!peer||x.sender===peer||x.recipient===peer).map(x=>({...x,variant:x.sender===user.id?'message own':'message',href:x.post?'#watch/'+x.post:'',date:date(x.created)})),empty:!events.length&&!messages.length},onAction:act});
 }else if(path==='settings'){
  content=R(Settings,{data:{nativeAndroid:new URLSearchParams(location.search).get('native')==='android',owner:user.role==='owner',relations:relations.filter(x=>x.state==='pending').map(x=>({...x,label:'Follow request · '+(x.actor||'').slice(0,8)})),reports,qualities:[{value:'auto',label:'Automatic'},{value:'0',label:'360p · less data'},{value:'1',label:'540p'},{value:'2',label:'720p'}],storageText:boot.photosConnected?'Protected Drive originals connected':'Protected Drive is unavailable',videoText:boot.videoRendering?'Video rendering connected':'FFmpeg and FFprobe need configuration',identityText:'Account: '+user.subject},onAction:act});
 }else content=R(Feed,{data,onAction:act});
 const sheetData={title:({comments:'Comments',more:'Clip options',music:'Add a sound',camera:'Capture a moment',voice:'Voiceover',source:'Your device media',locationOptions:'Location',audienceOptions:'Who can view this post',privacyOptions:'Privacy settings',moreOptions:'More options',shareOptions:'Share to',linkOptions:'Add link',coverOptions:'Edit cover'} as any)[sheet],commentsMode:sheet==='comments',moreMode:sheet==='more',musicMode:sheet==='music',cameraMode:sheet==='camera',voiceMode:sheet==='voice',sourceMode:sheet==='source',locationMode:sheet==='locationOptions',audienceMode:sheet==='audienceOptions',privacyMode:sheet==='privacyOptions',optionsMode:sheet==='moreOptions',shareMode:sheet==='shareOptions',linkMode:sheet==='linkOptions',coverMode:sheet==='coverOptions',coverVideo:!clips[0]?.photo,coverMax:Math.max(0,total-.1),audiences:[{value:'public',label:'Everyone on this server'},{value:'followers',label:'Followers'},{value:'private',label:'Only me'}],comments:comments.map(x=>({...x,handle:title(x.profile),initials:initials(x.profile)})),reason:focused?.reason||'Recommended from your community',owned:focused?.owner===user.id,music,recording,notRecording:!recording,recordStatus};
 const nav=[['home','House','For You'],['following','Users','Following'],['friends','UserRoundCheck','Friends'],['explore','Compass','Explore'],['inbox','MessageCircle','Inbox'],['profile','UserRound','Profile'],['live','Radio','LIVE']].map(([href,icon,title])=>({href:'#'+href,icon,title,variant:path===href?'nav active':'nav'}));
 const mobileNav=[nav[0],nav[3],{href:'#create',icon:'Plus',title:'Create',variant:'nav create'},nav[4],nav[5]];
 const fieldChange=(k:string,v:any)=>{sf(k,v);if(['sound','soundStart','soundVolume','originalVolume'].includes(k))invalidate();if(k==='coverTime'){setRendered('');prepared.current=[];pendingJob.current=null;publishKey.current=requestId()}};
 return p.render(R(Fields.Provider,{value:{fields,setField:fieldChange,disabled:!!p.busy,select:actionSelect,dismiss:()=>act('closeSheet'),widgets}},content,sheet&&R(Sheet,{data:sheetData,onAction:act})),{nav,mobileNav,offline,shellVariant:path==='create'&&step!=='edit'?'composer':'',context:{select:actionSelect,setField:fieldChange}},act,widgets);
}
