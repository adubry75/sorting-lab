const assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{const page=await browser.newPage();
 await page.addInitScript(()=>{const Native=AudioContext;window.audioProfile={waves:[],late:[]};window.AudioContext=class extends Native{
  constructor(...args){super(...args);window.actualAudio=this;}
  createPeriodicWave(...args){const start=performance.now(),w=super.createPeriodicWave(...args);audioProfile.waves.push(performance.now()-start);return w;}
  createOscillator(){const o=super.createOscillator(),start=o.start.bind(o),ctx=this;o.start=(when=0)=>{if(when)audioProfile.late.push((ctx.currentTime-when)*1000);start(when);};return o;}
  createBufferSource(){const o=super.createBufferSource(),start=o.start.bind(o),ctx=this;o.start=(when=0,...args)=>{if(when)audioProfile.late.push((ctx.currentTime-when)*1000);start(when,...args);};return o;}
 };});
 await page.goto('file:///'+path.join(__dirname,'index.html').replaceAll('\\','/'));await page.locator('#play').click();await page.waitForTimeout(5500);await page.locator('#play').click();
 const result=await page.evaluate(()=>{function summary(a){a.sort((x,y)=>x-y);return {count:a.length,mean:a.reduce((s,x)=>s+x,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};}return {wavesMs:summary(audioProfile.waves),lateMs:summary(audioProfile.late),sampleRate:actualAudio.sampleRate};});console.log(JSON.stringify(result));assert.ok(result.lateMs.count>50,'Measure a sustained live run');assert.ok(result.lateMs.max<=-4,'Every note must be queued at least 4ms before it sounds, never after its fade-in');}
 finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

