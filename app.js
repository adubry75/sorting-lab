(()=>{'use strict';
const $=id=>document.getElementById(id),fmt=new Intl.NumberFormat('en-US');
const algorithms=[
 ['merge','Merge Sort','Divide & conquer','O(n log n)','Split into smaller runs, then merge the ordered runs back together.','Thin rainbow petals combine into larger curves before settling on the rim.',0],
 ['quick','Quick Sort · middle pivot','Partition','O(n log n) average','Use the middle item as a pivot. Separate smaller and larger values, then repeat within each region.','Color regions separate and the empty center grows as large placement errors disappear.',34],
 ['heap','Heap Sort','Selection','O(n log n)','Build a maximum heap, then repeatedly move its largest value to the end of the array.','A finished arc grows backward while the remaining heap keeps rearranging.',68],
 ['dual','Quick Sort · dual pivot','Partition','O(n log n) average','Use two pivots to partition the values into low, middle, and high regions.','Three-way partitions produce distinct regions that resolve in smaller and smaller sections.',101],
 ['comb','Comb Sort','Exchange','O(n²) worst','Compare distant pairs and shrink the gap by about 1.3 each pass, finishing with adjacent pairs.','Big errors disappear first. Changing gaps produce bands that become finer toward the rim.',132],
 ['gravity','Gravity Sort','Distribution','Sampled bead simulation','Simulate integer values as rows of beads settling in columns. Uses bounded memory and samples up to 300 layers.','Many values change together, creating a flowing shape. Here dots are row totals, not falling beads.',167],
 ['radix','Radix Sort · LSD, base 10','Distribution','O(d × (n + 10))','Stably group by ones, tens, hundreds, and so on. Write back across the ten buckets in turn.','Repeated petals and bands reorganize together. Watch the ten digit buckets fill below.',202],
 ['shell','Shell Sort','Insertion','O(n²) worst · halving gaps','Insertion-sort interleaved sequences, halving their spacing on each pass until the gap is one.','Regularly spaced sequences create repeating structure, followed by finer corrections.',232],
 ['gnome','Gnome Sort','Exchange','O(n²) average','Walk forward when neighbors are ordered. Otherwise swap them and step backward to repair the order.','An ordered prefix grows through tiny backward repairs, leaving the untouched remainder scattered.',268],
 ['shaker','Shaker Sort','Exchange','O(n²) average','Bubble in both directions: large values go to the end, small values to the beginning.','A finished region grows away from the wraparound seam in both directions.',284],
 ['bubble','Bubble Sort','Exchange','O(n²) average','Swap reversed neighbors. Each forward pass delivers the largest remaining value to the end.','A finished outer arc grows while the remaining cloud shifts through many small movements.',303],
 ['odd','Odd Even Sort','Exchange','O(n²) average','Alternate between odd-position neighbor pairs and even-position pairs until no swaps remain.','Distributed neighbor exchanges organize the cloud in alternating waves.',322],
 ['double','Double Selection Sort','Selection','O(n²)','Find the smallest and largest remaining values, then put them at opposite ends.','The outer arc grows at both ends while the middle cloud stays relatively untouched.',340],
 ['insertion','Insertion Sort','Insertion','O(n²) average','Take the next value and shift it into its place within the ordered prefix, like sorting cards in your hand.','A smooth ordered curve consumes the scattered region. Try a nearly sorted input.',358],
 ['counting','Counting Sort','Distribution','O(n + k)','Count each value in an auxiliary array, then write the values back in order. Here k equals the element count.','The circle initially stays still while the counters fill. Then a clean sweep writes the rim.',391],
 ['selection','Selection Sort','Selection','O(n²)','Search for the smallest remaining value and swap it into the next unfilled position.','A clean arc grows while most of the cloud stays still. Searching costs comparisons, not writes.',424],
 ['bucket','Bucket Sort · video variant','Distribution','O(n + k)','The video uses one counter per integer value, making this variant equivalent to counting sort.','The auxiliary counters fill first; then the visible array is rewritten in a clean sweep.',456],
 ['cycle','Cycle Sort','Write minimizing','O(n²)','Count smaller values to find an item’s final position. Place it there, then follow the displaced item.','Interior dots resolve directly onto the rim at scattered positions. Few writes can hide many comparisons.',489],
 ['flag','American Flag Sort · video variant','Distribution','O(n) for these ranks','Use one bucket per value, calculate destination positions, then follow cycles to place each value.','After the auxiliary preparation, scattered interior dots jump to their final positions on the rim.',535],
 ['tim','Tim Sort · video variant','Hybrid','O(n log n)','Insertion-sort fixed runs of 32, then merge progressively larger runs. This is a simplified TimSort variant.','Fine ordered curves merge into larger petals and eventually into the finished circle.',567]
];
const slow=new Set(['gnome','shaker','bubble','odd','double','insertion','selection','cycle']);
// Dense low/mid-range stops keep slower algorithms easy to watch; wider high
// ranges still reach a million checkpoints without an impractically long slider.
const speeds=[...Array.from({length:10},(_,i)=>i+1),...Array.from({length:9},(_,i)=>(i+2)*10),...[100,1000,10000,100000].flatMap(base=>Array.from({length:36},(_,i)=>base+(i+1)*base/4))];
$('speed').max=String(speeds.length-1);$('speed').value=String(speeds.indexOf(500));
$('algorithm').replaceChildren(...algorithms.map(([id,name])=>{const o=document.createElement('option');o.value=id;o.textContent=name;return o;}));
const canvas=$('plot'),ctx=canvas.getContext('2d',{alpha:false}),auxcanvas=$('auxplot'),auxctx=auxcanvas.getContext('2d');
let array=new Int32Array(0),initial=null,worker=null,token=0,ready=false,pending=false,running=false,done=false,started=false,fast=false;
let sin,cos,palette,pixels,image,dirty=true,lastAux=[],lastPaint=0,lastPhase='',lastSample=0,finalPositions=0;
let lastMetrics={comparisons:0,writes:0,auxWrites:0,swaps:0,computeMs:0};
const workerUrl=URL.createObjectURL(new Blob(['('+SortingEngine.toString()+')(self);'],{type:'application/javascript'}));
let soundStep=false;
const sound=new SortingAudio({onError:()=>{sound.setEnabled(false);soundControls();$('sound-note').textContent='Sound could not start. Click Sound on to try again.';}});
function soundControls(){$('sound').textContent=sound.enabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound.enabled));$('volume-label').textContent=Math.round(sound.volume*100)+'%';$('bass-label').textContent=Math.round(sound.bass*100)+'%';$('phaser-label').textContent=Math.round(sound.phaser*100)+'%';$('reverb-label').textContent=Math.round(sound.reverb*100)+'%';}
$('sound').addEventListener('click',()=>{sound.setEnabled(!sound.enabled);if(sound.enabled){sound.unlock();$('sound-note').textContent='Pitch follows the highlighted values.';}soundControls();});
$('volume').addEventListener('input',()=>{sound.setVolume(Number($('volume').value)/100);soundControls();});
$('bass').addEventListener('input',()=>{sound.setBass(Number($('bass').value)/100);soundControls();});
$('phaser').addEventListener('input',()=>{sound.setPhaser(Number($('phaser').value)/100);soundControls();});
$('reverb').addEventListener('input',()=>{sound.setReverb(Number($('reverb').value)/100);soundControls();});
$('tone').addEventListener('change',()=>{sound.setTone($('tone').value);$('sound-note').textContent=sound.tone==='reference'?'Video-derived tone · follows the highlighted values.':'Soft synth · follows the highlighted values.';});
soundControls();
function seeded(n,pattern,seed){const a=Int32Array.from({length:n},(_,i)=>i);let s=seed>>>0;const rand=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};const swap=(i,j)=>{const t=a[i];a[i]=a[j];a[j]=t;};
 if(pattern==='reverse')a.reverse();else if(pattern==='random')for(let i=n-1;i>0;i--)swap(i,Math.floor(rand()*(i+1)));else if(pattern==='almost')for(let k=0;k<Math.max(1,Math.floor(n*.01));k++){const i=Math.floor(rand()*n);swap(i,Math.min(n-1,i+1+Math.floor(rand()*8)));}return a;}
function rgb(h){const s=.76,l=.66,a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return Math.round((l-a*Math.max(-1,Math.min(k-3,9-k,1)))*255);};return (255<<24)|(f(4)<<16)|(f(8)<<8)|f(0);}
function prepare(){const n=array.length;sin=new Float32Array(n);cos=new Float32Array(n);palette=new Uint32Array(n);for(let i=0;i<n;i++){const t=i/n*Math.PI*2;sin[i]=Math.sin(t);cos[i]=Math.cos(t);palette[i]=rgb((i/n*360+260)%360);}dirty=true;}
function resize(){const side=Math.max(1,Math.min(1100,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2))));if(canvas.width!==side||canvas.height!==side){canvas.width=canvas.height=side;image=ctx.createImageData(side,side);pixels=new Uint32Array(image.data.buffer);dirty=true;}const w=Math.round(auxcanvas.clientWidth*Math.min(devicePixelRatio||1,2));if(auxcanvas.width!==w){auxcanvas.width=w;auxcanvas.height=140;}drawAux();}
function draw(){if(!image||!array.length)return;const w=canvas.width,c=w/2,R=w*.435,n=array.length,size=n<=256?Math.max(2,Math.round(w/180)):n<=5000?2:1;
 pixels.fill(0xff140e0b);finalPositions=0;
 for(let i=0;i<n;i++){const v=array[i];if(v===i)finalPositions++;const d=Math.abs(i-v),r=R*(1-2*Math.min(d,n-d)/n),x=Math.floor(c+sin[i]*r),y=Math.floor(c-cos[i]*r),color=palette[v];for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<w)pixels[yy*w+xx]=color;}}
 ctx.putImageData(image,0,0);ctx.strokeStyle='#293249';ctx.lineWidth=1;ctx.beginPath();ctx.arc(c,c,R+3,0,Math.PI*2);ctx.stroke();
 $('placed').textContent=(finalPositions/n*100).toFixed(1)+'%';canvas.setAttribute('aria-label',`${fmt.format(n)} values; ${(finalPositions/n*100).toFixed(1)} percent in their final positions.`);dirty=false;
}
function drawAux(){const w=auxcanvas.width,h=auxcanvas.height;auxctx.clearRect(0,0,w,h);const bins=lastAux.length?lastAux:Array(100).fill(0),max=Math.max(1,...bins),bw=w/bins.length;for(let i=0;i<bins.length;i++){const bh=lastAux.length?Math.max(2,bins[i]/max*(h-10)):2;auxctx.fillStyle=lastAux.length?'#839bcc':'#263148';auxctx.fillRect(i*bw,h-bh,Math.max(1,bw-3),bh);}}
function phase(text){if(text!==lastPhase){$('phase').textContent=text;lastPhase=text;}}
function state(value){$('state-pill').textContent=value;$('state-pill').dataset.state=value.toLowerCase();}
function controls(){
 $('play').textContent=running?'Ⅱ Pause':done?'↻ Replay':started?'▶ Resume':'▶ Start sorting';
 $('play').disabled=!ready;$('step').disabled=!ready||running||done||pending;$('benchmark').disabled=!ready||running;
}
function metadata(){const index=algorithms.findIndex(x=>x[0]===$('algorithm').value),a=algorithms[index];$('current-name').textContent=a[1];$('family').textContent=a[2];$('complexity').textContent=a[3];$('description').textContent=a[4];$('watch').textContent=a[5];$('chapter').href='https://www.youtube.com/watch?v=M3OuTtW662Y&t='+a[6]+'s';$('algorithm-index').textContent=String(index+1).padStart(2,'0')+' / 20';
 const n=Number($('size').value);$('run-note').textContent=slow.has(a[0])&&n>=5000?'This algorithm can need millions or billions of comparisons here. Try 256 or 1,024 elements for a shorter experiment. You can pause or reset anytime.':'Timing includes algorithm instrumentation and excludes waiting between frames. It is not a cross-language benchmark.';
 $('element-label').textContent=fmt.format(n)+' elements';
}
function reset(autoStart=false,benchmark=false){
 sound.silence();soundStep=false;
 worker?.terminate();token++;ready=false;pending=false;running=false;done=false;started=false;fast=benchmark;lastAux=[];lastMetrics={comparisons:0,writes:0,auxWrites:0,swaps:0,computeMs:0};metrics();
 const n=Number($('size').value);let seed=Number($('seed').value);if(!Number.isInteger(seed)||seed<0||seed>4294967295){seed=42;$('seed').value='42';}
 initial=seeded(n,$('pattern').value,seed);array=initial.slice();prepare();metadata();state('Ready');phase('Shuffled and ready');if($('pattern').value!=='random')phase('Input ready');
 $('aux-title').textContent='Auxiliary workspace';$('aux-count').textContent='No active buffer';$('aux-note').textContent='Temporary buffers and bucket counts appear here as the algorithm works.';drawAux();controls();
 try{worker=new Worker(workerUrl);worker.onerror=e=>{sound.silence();running=false;ready=false;pending=false;state('Error');phase(e.message||'Worker could not start. Try another browser.');controls();};
 worker.onmessage=e=>{const q=e.data;if(q.token!==token)return;pending=false;if(q.type==='error'){sound.silence();running=false;ready=false;state('Error');phase(q.message);controls();return;}
 if(q.done){if(!fast&&running&&!document.hidden)sound.finish();else sound.silence();}else if(!fast&&!document.hidden&&(running||soundStep)&&q.soundValue!==null)sound.play(q.soundValue,array.length,{step:soundStep});soundStep=false;
 const wasReady=ready;ready=true;lastMetrics=q.metrics;metrics();if(q.array){array=q.array;dirty=true;}lastAux=q.aux;drawAux();$('aux-title').textContent=q.auxLength?q.auxLabel:'Auxiliary workspace';$('aux-count').textContent=q.auxLength?fmt.format(q.auxLength)+' entries':'No active buffer';$('aux-note').textContent=q.auxLength>100?'Each bar shows the mean of a consecutive group of entries; scale follows the current maximum.':q.auxLength?'Each bar is one auxiliary entry; scale follows the current maximum.':'No auxiliary data is active yet. Small bookkeeping variables are not shown.';
 if(q.done){running=false;done=true;state('Complete');phase(fast?'Finished without animation':'All values in order');fast=false;dirty=true;}else if(started){phase(q.phase);state(running?(fast?'Timing':'Sorting'):'Paused');}
 if(!wasReady&&autoStart){running=true;started=true;state(fast?'Timing':'Sorting');}controls();};
 worker.postMessage({type:'init',token,algorithm:$('algorithm').value,array:initial});
 }catch(e){state('Error');phase(e.message);}
}
function metrics(){$('comparisons').textContent=fmt.format(lastMetrics.comparisons);$('writes').textContent=fmt.format(lastMetrics.writes);$('auxwrites').textContent=fmt.format(lastMetrics.auxWrites);const ms=lastMetrics.computeMs;$('compute').textContent=ms>=1000?(ms/1000).toFixed(2)+' s':ms.toFixed(ms<10?2:1)+' ms';}
function tick(one=false){if(!ready||pending||done)return;pending=true;const now=performance.now(),sample=now-lastSample>300;if(sample)lastSample=now;worker.postMessage({type:'tick',token,budget:one?1:fast?2000000:speeds[Number($('speed').value)],fast,sample});controls();}
function play(){if(!ready)return;if(done){sound.unlock();reset(true);return;}running=!running;if(running&&!fast)sound.unlock();else sound.silence();soundStep=false;started=true;state(running?(fast?'Timing':'Sorting'):'Paused');controls();}
function step(){if(!ready||running||done||pending)return;sound.unlock();soundStep=true;started=true;fast=false;state('Paused');tick(true);}
$('play').addEventListener('click',play);$('step').addEventListener('click',step);$('reset').addEventListener('click',()=>reset());$('shuffle').addEventListener('click',()=>{const x=new Uint32Array(1);crypto.getRandomValues(x);$('seed').value=x[0];reset();});$('benchmark').addEventListener('click',()=>reset(true,true));
for(const id of ['algorithm','size','pattern','seed'])$(id).addEventListener('change',()=>reset());
function speedLabel(){const n=speeds[Number($('speed').value)],description=fmt.format(n)+' step'+(n===1?'':'s')+' per frame';$('speed-label').textContent=description.replace(' per frame',' / frame');$('speed').setAttribute('aria-valuetext',description);}$('speed').addEventListener('input',speedLabel);
$('download').addEventListener('click',()=>{const html='<!doctype html>\n'+document.documentElement.outerHTML,url=URL.createObjectURL(new Blob([html],{type:'text/html'})),a=document.createElement('a');a.href=url;a.download='sorting-lab.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);});
function snapshot(){return {algorithm:$('algorithm').value,elements:array.length,seed:Number($('seed').value),pattern:$('pattern').value,state:$('state-pill').textContent,phase:lastPhase,metrics:{...lastMetrics},correctlyPlaced:finalPositions};}
async function settle(){const deadline=performance.now()+5000;while((!ready||pending)&&performance.now()<deadline){if($('state-pill').dataset.state==='error')throw new Error(lastPhase);await new Promise(resolve=>setTimeout(resolve,10));}if(!ready||pending)throw new Error('Experiment is still initializing');if(dirty)draw();return snapshot();}
function registerTools(){const context=document.modelContext;if(!context?.registerTool)return;const abort=new AbortController();window.addEventListener('pagehide',()=>abort.abort(),{once:true});
 const tools=[{name:'read_sorting_state',description:'Read the selected algorithm, input, playback state, and operation counters.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>snapshot()},
 {name:'configure_sorting_experiment',description:'Select an algorithm, element count, starting order, and seed. Cancels the current run and prepares a fresh paused experiment.',inputSchema:{type:'object',properties:{algorithm:{type:'string',enum:algorithms.map(a=>a[0])},elements:{type:'integer',enum:[64,256,1024,5000,10000,50000]},pattern:{type:'string',enum:['random','almost','reverse','sorted']},seed:{type:'integer',minimum:0,maximum:4294967295}},additionalProperties:false},annotations:{readOnlyHint:false},execute:async q=>{if(!q||typeof q!=='object'||Array.isArray(q))throw new Error('Expected experiment settings');const allowed=['algorithm','elements','pattern','seed'];if(Object.keys(q).some(k=>!allowed.includes(k)))throw new Error('Unknown setting');if(q.algorithm!==undefined&&!algorithms.some(a=>a[0]===q.algorithm))throw new Error('Unknown algorithm');if(q.elements!==undefined&&![64,256,1024,5000,10000,50000].includes(q.elements))throw new Error('Unsupported element count');if(q.pattern!==undefined&&!['random','almost','reverse','sorted'].includes(q.pattern))throw new Error('Unknown starting order');if(q.seed!==undefined&&(!Number.isInteger(q.seed)||q.seed<0||q.seed>4294967295))throw new Error('Invalid seed');for(const [k,id]of [['algorithm','algorithm'],['elements','size'],['pattern','pattern'],['seed','seed']])if(q[k]!==undefined)$(id).value=q[k];reset();return await settle();}},
 {name:'control_sorting_playback',description:'Start, pause, step, or reset the visible sorting experiment.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['start','pause','step','reset']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async q=>{if(!q||!['start','pause','step','reset'].includes(q.action)||Object.keys(q).some(k=>k!=='action'))throw new Error('Invalid playback action');if(q.action==='reset')reset();else if(q.action==='pause'){sound.silence();soundStep=false;running=false;if(started&&!done)state('Paused');controls();}else{if(!ready)throw new Error('Experiment is initializing; try again');if(q.action==='start'&&!running)play();if(q.action==='step'){if(running)throw new Error('Pause before stepping');if(pending)throw new Error('Previous step is finishing');if(done)throw new Error('Reset the completed run before stepping');step();}}if(q.action!=='start')return await settle();return snapshot();}}];
 for(const t of tools){try{Promise.resolve(context.registerTool(t,{signal:abort.signal})).catch(()=>{});}catch{}}
}
new ResizeObserver(resize).observe(canvas);new ResizeObserver(resize).observe(auxcanvas);speedLabel();reset();resize();registerTools();
function loop(now){if(dirty&&now-lastPaint>30){draw();lastPaint=now;}if(running&&!pending)tick();requestAnimationFrame(loop);}requestAnimationFrame(loop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)sound.silence();});
window.addEventListener('pagehide',()=>{sound.dispose();worker?.terminate();URL.revokeObjectURL(workerUrl);},{once:true});
})();

