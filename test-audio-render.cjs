const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.goto('about:blank');await page.addScriptTag({path:path.resolve(process.env.AUDIO_SOURCE||path.join(__dirname,'audio.js'))});
 const result=await page.evaluate(async()=>{
  async function render(rate,extreme=false){
   const sr=44100,off=new OfflineAudioContext(2,sr*2,sr);let clock=0;const context=new Proxy(off,{get(t,k){if(k==='state')return 'running';if(k==='currentTime')return clock;if(k==='resume'||k==='close')return ()=>Promise.resolve();const v=t[k];return typeof v==='function'?v.bind(t):v;}});
   const sound=new SortingAudio({createContext:()=>context});await sound.unlock();if(extreme){sound.setVolume(1);sound.setBass(1);sound.setPhaser(1);sound.setReverb(1);}
   for(let frame=0;frame<rate*1.5;frame++){clock=frame/rate;sound.play(extreme?(frame%41)*100:0,4100);}
   clock=1.5;sound.silence();const buffer=await off.startRendering(),x=buffer.getChannelData(0),y=buffer.getChannelData(1);
   let sum=0,peak=0,tail=0,dc=0;for(let j=0;j<x.length;j++){peak=Math.max(peak,Math.abs(x[j]),Math.abs(y[j]));if(j>=sr*.5&&j<sr*1.4){sum+=(x[j]**2+y[j]**2)/2;dc+=x[j];}if(j>sr*1.6)tail=Math.max(tail,Math.abs(x[j]),Math.abs(y[j]));}
   function amplitude(f){let re=0,im=0;const N=32768,start=Math.round(.5*sr);for(let j=0;j<N;j++){const w=.5-.5*Math.cos(2*Math.PI*j/(N-1)),v=x[start+j]*w,angle=2*Math.PI*f*j/sr;re+=v*Math.cos(angle);im+=v*Math.sin(angle);}return Math.hypot(re,im);}
   return {rate,rms:Math.sqrt(sum/(.9*sr)),peak,tail,dc:dc/(.9*sr),pitchRatio:amplitude(41.203445)/amplitude(60)};
  }
  const steady=[];for(const rate of [30,60,120])steady.push(await render(rate));return {steady,extreme:await render(120,true)};
 });
 console.log(JSON.stringify(result));
 for(const r of result.steady){assert.ok(r.pitchRatio>8,`41Hz bass must survive ${r.rate} updates/s without becoming a 60Hz buzz (ratio ${r.pitchRatio})`);assert.ok(r.rms>.11&&r.rms<.30,'Default bass-note level must approach the supplied recording');assert.ok(r.tail<1e-6,'Pause must silence both channels');assert.ok(Math.abs(r.dc)<.01,'Bass must not be a DC offset');}
 assert.ok(Math.max(...result.steady.map(x=>x.rms))/Math.min(...result.steady.map(x=>x.rms))<1.1,'Bass level must stay stable across display rates');assert.ok(result.extreme.peak<.99,'Full volume and effects must stay below digital clipping');assert.ok(result.extreme.tail<1e-6,'Effects must stop with playback');console.log('PASS: bass pitch, level, refresh-rate independence, clipping headroom, and clean stop');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

