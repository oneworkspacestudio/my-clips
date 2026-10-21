import{spawn}from'node:child_process';import{randomBytes}from'node:crypto';import{mkdir,writeFile}from'node:fs/promises';import path from'node:path';
const root=path.resolve(import.meta.dirname,'..'),tool='I:/Projects/tooling/clips-upload-20261021',data='C:/Projects/.cache/clips-upload-20261021/browser-'+Date.now(),exe=process.env.MYCLIPS_TEST_EXE||tool+'/MyClips.exe',origin='http://localhost:29124',password=randomBytes(24).toString('hex');
await mkdir(data,{recursive:true});
const env={...process.env,WORKSPACE_BOOTSTRAP_PASSWORD:password,MYCLIPS_FFMPEG:'C:/ffmpeg/bin/ffmpeg.exe',MYCLIPS_FFPROBE:'C:/ffmpeg/bin/ffprobe.exe',MYCLIPS_PHOTOS_ROOT:data+'/My Photos/My Clips',MYCLIPS_STANDALONE_STORAGE:'isolated'};
for(const name of Object.keys(env))if(name.startsWith('WORKSPACE_OIDC_')||name==='WORKSPACE_HOME_URL')delete env[name];
const child=spawn(exe,['--data',data+'/Private','--listen','127.0.0.1:29124','--origin',origin,'--bootstrap-email','creator@example.test','--no-browser'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);let code=1;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin+'/healthz')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,300))}
 if(!ready)throw Error('Preview failed to start: '+log);
 const test=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...(process.env.MYCLIPS_FULL_TESTS?['tests/clips.spec.ts','tests/upload.spec.ts']:['tests/upload.spec.ts'])],{cwd:root+'/web',env:{...process.env,MYCLIPS_TEST_URL:origin,MYCLIPS_TEST_PASSWORD:password},windowsHide:true,stdio:'inherit'});code=await new Promise(r=>test.on('exit',r));
}finally{child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));await writeFile(tool+'/browser-process.json',JSON.stringify({pid:child.pid,data,exe,port:29124,stopped:true,testExit:code}));}
process.exitCode=code;
