import React,{useEffect,useRef,useState} from 'react';
import Hls from 'hls.js';
import {base} from './main';

export function Player({post,request,quality='auto',dataSaver=false,onLike}:any){
 const ref=useRef<HTMLVideoElement>(null),hls=useRef<Hls|null>(null),event=useRef(crypto.randomUUID()),watched=useRef(0),last=useRef(0);
 const [active,setActive]=useState(false),[muted,setMuted]=useState(true),[error,setError]=useState('');
 const url=base+'/api/stream/'+post.media[0]+'/';
 const flush=()=>{const video=ref.current;if(!video||!video.duration||watched.current===0)return;request('/api/posts/'+post.id+'/signal',{method:'POST',body:JSON.stringify({event:event.current,seconds:Math.min(600,watched.current),duration:Math.min(600,video.duration)})}).catch(()=>{});event.current=crypto.randomUUID();watched.current=0};
 useEffect(()=>{
  const video=ref.current!;const observer=new IntersectionObserver(([entry])=>setActive(entry.intersectionRatio>=.65),{threshold:[0,.65,1]});observer.observe(video);
  const pause=()=>{if(document.hidden){video.pause();flush()}};
  document.addEventListener('visibilitychange',pause);
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',pause);flush()};
 },[post.id]);
 useEffect(()=>{
  const video=ref.current!;
  if(!active){video.pause();flush();hls.current?.stopLoad();return}
  if(!video.src&&!hls.current){
   if(Hls.isSupported()){
    const engine=new Hls({startLevel:0,capLevelToPlayerSize:true,maxBufferLength:dataSaver?6:12,maxMaxBufferLength:20,backBufferLength:2,abrEwmaDefaultEstimate:500000,abrBandWidthFactor:.7,abrBandWidthUpFactor:.5,enableWorker:true});hls.current=engine;
    engine.loadSource(url+'master.m3u8');engine.attachMedia(video);
    engine.on(Hls.Events.MANIFEST_PARSED,()=>{engine.currentLevel=quality==='auto'?-1:Number(quality);if(dataSaver)engine.autoLevelCapping=0;video.play().catch(()=>{})});
    engine.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal){engine.destroy();hls.current=null;video.src=url+'video.mp4';video.play().catch(()=>setError('Tap to play'))}});
   }else{video.src=video.canPlayType('application/vnd.apple.mpegurl')?url+'master.m3u8':url+'video.mp4'}
  }else hls.current?.startLoad();
  video.play().catch(()=>{});
 },[active,url]);
 useEffect(()=>()=>{hls.current?.destroy();hls.current=null},[post.id]);
 const toggle=()=>{const v=ref.current!;if(v.paused)v.play().catch(()=>setError('Playback unavailable'));else v.pause()};
 return React.createElement('div',{className:'player'},
  React.createElement('video',{ref,playsInline:true,loop:true,muted,preload:'none',poster:url+'poster.jpg','aria-label':post.caption||'Short video',onClick:toggle,onDoubleClick:onLike,onError:()=>setError('Video unavailable. Reconnect and retry.'),onTimeUpdate:()=>{const v=ref.current!;const delta=v.currentTime-last.current;if(!v.paused&&!document.hidden&&delta>0&&delta<2)watched.current+=delta;last.current=v.currentTime},onEnded:flush}),
  React.createElement('button',{className:'sound-toggle',onClick:()=>setMuted(!muted),'aria-label':muted?'Unmute video':'Mute video'},muted?'♪ Sound off':'♪ Sound on'),
  React.createElement('button',{className:'play-toggle',onClick:toggle,'aria-label':'Play or pause video'},'▶ / Ⅱ'),
  error&&React.createElement('span',{className:'playback-error',role:'status'},error)
 );
}

export function Preview({file,url,filter='none',flip=false}:any){
 const [src,setSrc]=useState(url||'');
 useEffect(()=>{if(!file){setSrc(url||'');return}const u=URL.createObjectURL(file);setSrc(u);return()=>URL.revokeObjectURL(u)},[file,url]);
 const filters:any={none:'none',vivid:'saturate(1.35) contrast(1.08)',warm:'sepia(.2) saturate(1.1)',cool:'hue-rotate(12deg)',mono:'grayscale(1)',vintage:'sepia(.35) saturate(.65)',glow:'brightness(1.08) saturate(1.12)'};
 return src?React.createElement('video',{className:'editor-video',src,controls:true,playsInline:true,style:{filter:filters[filter],transform:flip?'scaleX(-1)':'none'},'aria-label':'Clip preview'}):React.createElement('div',{className:'editor-placeholder'},'MAKE IT YOURS');
}
