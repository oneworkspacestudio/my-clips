import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';

const appRoot=path.resolve('..');
const suiteRoot=process.env.MYCLIPS_WORKSPACE_SOURCE;
test('integrated Workspace navigation never covers phone tabs',async({page})=>{
 test.skip(!suiteRoot,'Set MYCLIPS_WORKSPACE_SOURCE to test the shared picker adapter.');
 const dist=path.join(appRoot,'internal/webui/dist');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const apps=[
  {ID:'clips',Name:'My Clips',Route:'/clips/',URL:'/_workspace/open/clips'},
  {ID:'drive',Name:'Drive',Route:'/drive/',URL:'/_workspace/open/drive'},
  {ID:'search',Name:'Search',Route:'/search/',URL:'/_workspace/open/search'},
 ];
 await page.route('http://navigation.test/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/_workspace/apps')return route.fulfill({json:{apps,name:'Synthetic layout account'}});
  if(url.pathname.startsWith('/_workspace/navigation.')){
   const file=path.join(suiteRoot!,'internal/suite/navigation',path.basename(url.pathname));
   return route.fulfill({body:readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':'text/css'});
  }
  if(url.pathname.includes('/api/')){
   const endpoint=url.pathname.split('/api/')[1];
   const user={id:'synthetic',name:'Layout account',role:'member',subject:'synthetic'};
   const json=endpoint==='bootstrap'?{id:'clips',name:'My Clips',version:'test',workspace:'http://navigation.test/'}:
    endpoint==='me'?{user,csrf:'synthetic'}:endpoint==='clips'?{profile:{handle:'creator',name:'Layout account'},photosConnected:true}: [];
   return route.fulfill({json});
  }
  const relative=url.pathname.replace(/^\/clips\/?/,'')||'index.html';
  const file=path.resolve(dist,relative);
  if(!file.startsWith(dist+path.sep)||!existsSync(file))return route.fulfill({status:404,body:''});
  const types:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
  let body:Buffer|string=readFileSync(file);
  if(relative==='index.html')body=body.toString().replace('</body>','<script defer src="/_workspace/navigation.js"></script></body>');
  return route.fulfill({body,contentType:types[path.extname(file)]||'application/octet-stream'});
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://navigation.test/clips/');
 await expect(page.getByRole('heading',{name:'A little moment. A whole story.'})).toBeVisible();
 const floating=page.locator('#one-workspace-nav').getByRole('button',{name:'Open Workspace apps'});
 const trigger=page.locator('[data-workspace-apps-trigger]:visible');
 for(const width of [320,360,390,600,768,1024]){
  await page.setViewportSize({width,height:844});
  await expect(trigger).toHaveCount(1);
  await expect(floating).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width<=600){
   const links=page.locator('.row--bottomnav > a');
   await expect(links).toHaveCount(6);
   const boxes=await links.evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}));
   for(let i=0;i<boxes.length;i++){
    expect(boxes[i].width).toBeGreaterThanOrEqual(44);
    expect(boxes[i].height).toBeGreaterThanOrEqual(44);
    if(i)expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i-1].right-.1);
   }
  }
  await trigger.click();
  await expect(page.getByRole('dialog',{name:'Workspace apps'})).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
 }
 await page.setViewportSize({width:390,height:844});
 for(const [label,hash] of [['For You','#home'],['Explore','#explore'],['Create','#create'],['Inbox','#inbox'],['Profile','#profile']]){
  await page.locator('.row--bottomnav').getByRole('link',{name:label,exact:true}).click();
  await expect.poll(()=>new URL(page.url()).hash).toBe(hash);
  await expect(floating).toBeHidden();
 }
 await trigger.focus();await page.keyboard.press('Space');
 await expect(page.getByRole('dialog',{name:'Workspace apps'})).toBeVisible();
 await page.getByRole('button',{name:'Close Workspace apps'}).click();
 await expect(trigger).toBeFocused();
 await page.goto('http://navigation.test/clips/#home');
 await expect(trigger).toBeVisible();
 await expect(floating).toBeHidden();
 await page.screenshot({path:'../docs/screenshots/workspace-mobile.png'});
 // When an app removes its integrated controls, the shared fallback must return.
 await page.locator('[data-workspace-apps-trigger]').evaluateAll(elements=>elements.forEach(el=>el.remove()));
 await expect(floating).toBeVisible();
 await floating.click();
 await expect(page.getByRole('dialog',{name:'Workspace apps'})).toBeVisible();
 expect(errors).toEqual([]);
});
