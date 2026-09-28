/* Sorting Lab. Algorithm adaptations from 66-m/sorting-visualizer, AGPL-3.0.
   Self-contained factory: shared by the browser worker and Node correctness tests. */
function SortingEngine(host) {
  const ids=['merge','quick','heap','dual','comb','gravity','radix','shell','gnome','shaker','bubble','odd','double','insertion','counting','selection','bucket','cycle','flag','tim'];
  function create(id,input) {
    if(!ids.includes(id)) throw new Error('Unknown algorithm');
    const n=input.length, seen=new Uint8Array(n);
    for(const v of input) {if(!Number.isInteger(v)||v<0||v>=n||seen[v]) throw new Error('Expected a permutation of 0 through n-1');seen[v]=1;}
    const s={a:Int32Array.from(input),aux:new Int32Array(0),auxLabel:'No auxiliary array',phase:'Ready',active:[],soundIndex:-1,metrics:{comparisons:0,swaps:0,writes:0,auxWrites:0},iterator:null};
    const a=s.a,m=s.metrics;
    function cmp(x,y){m.comparisons++;return x-y;}
    function set(i,v){a[i]=v;m.writes++;s.active=[i];s.soundIndex=Math.max(s.soundIndex,i);}
    function swap(i,j){s.active=[i,j];if(i!==j){const t=a[i];a[i]=a[j];a[j]=t;m.swaps++;m.writes+=2;s.soundIndex=Math.max(s.soundIndex,i,j);}}
    function mark(i,j=i){s.active=[i,j];}
    function* insertion(lo=0,hi=n-1,gap=1){
      for(let i=lo+gap;i<=hi;i++){const v=a[i];let j=i;
        while(j-gap>=lo){mark(j,j-gap);const c=cmp(a[j-gap],v);yield;if(c<=0)break;set(j,a[j-gap]);yield;j-=gap;}
        set(j,v);yield;
      }
    }
    function* mergeParts(lo,mid,hi){
      s.phase='Copying a run';const b=new Int32Array(hi-lo+1);s.aux=b;s.auxLabel='Merge buffer';
      for(let k=lo;k<=hi;k++){b[k-lo]=a[k];m.auxWrites++;mark(k);yield;}
      s.phase='Merging runs';let i=0,j=mid-lo+1;const endLeft=j;
      for(let k=lo;k<=hi;k++){let v;if(i>=endLeft)v=b[j++];else if(j>=b.length)v=b[i++];else{v=cmp(b[i],b[j])<=0?b[i++]:b[j++];}set(k,v);yield;}
    }
    function* merge(lo=0,hi=n-1){if(lo>=hi)return;const mid=(lo+hi)>>1;yield*merge(lo,mid);yield*merge(mid+1,hi);yield*mergeParts(lo,mid,hi);}
    function* quick(){const stack=[[0,n-1]];while(stack.length){const [lo,hi]=stack.pop();if(lo>=hi)continue;let i=lo,j=hi;const p=a[(lo+hi)>>1];s.phase='Partitioning around a pivot';
      while(i<=j){while(true){mark(i);const c=cmp(a[i],p);yield;if(c>=0)break;i++;}while(true){mark(j);const c=cmp(a[j],p);yield;if(c<=0)break;j--;}if(i<=j){swap(i++,j--);yield;}}
      if(i<hi)stack.push([i,hi]);if(lo<j)stack.push([lo,j]);}}
    function* dual(){const stack=[[0,n-1]];while(stack.length){const [lo,hi]=stack.pop();if(lo>=hi)continue;s.phase='Partitioning into three regions';if(cmp(a[lo],a[hi])>0)swap(lo,hi);yield;const p=a[lo],q=a[hi];let l=lo+1,g=hi-1,k=l;
      while(k<=g){mark(k);if(cmp(a[k],p)<0){swap(k,l++);yield;}else if(cmp(a[k],q)>0){while(k<g){mark(g);const c=cmp(a[g],q);yield;if(c<=0)break;g--;}swap(k,g--);yield;if(cmp(a[k],p)<0){swap(k,l++);yield;}}k++;yield;}
      swap(lo,--l);yield;swap(hi,++g);yield;stack.push([g+1,hi],[l+1,g-1],[lo,l-1]);}}
    function* heap(){function* sift(root,len){while(root*2+1<len){let c=root*2+1;if(c+1<len&&cmp(a[c],a[c+1])<0)c++;mark(root,c);const order=cmp(a[root],a[c]);yield;if(order>=0)return;swap(root,c);yield;root=c;}}
      s.phase='Building the heap';for(let i=(n>>1)-1;i>=0;i--)yield*sift(i,n);s.phase='Extracting maximum values';for(let end=n-1;end>0;end--){swap(0,end);yield;yield*sift(0,end);}}
    function* comb(){let gap=n,changed=true;while(gap>1||changed){gap=Math.max(1,Math.floor(gap*10/13));s.phase='Comparing with gap '+gap;changed=false;for(let i=0;i+gap<n;i++){mark(i,i+gap);if(cmp(a[i],a[i+gap])>0){swap(i,i+gap);changed=true;}yield;}}}
    function* gravity(){
      if(n<2)return;s.phase='Building bead columns';const original=a.slice();s.aux=new Int32Array(n);s.auxLabel='Beads per column';
      for(let i=0;i<n;i++){s.aux[original[i]]++;m.auxWrites++;mark(i);yield;}
      for(let i=n-2;i>=0;i--){s.aux[i]+=s.aux[i+1];m.auxWrites++;yield;}
      // For unique ranks 0..n-1, each descending bead column has one more bead.
      // Sample at most 300 settled layers, without allocating a quadratic bead grid.
      const stride=Math.max(1,Math.ceil((n-1)/300));
      for(let t=Math.min(stride,n-1);;t=Math.min(n-1,t+stride)){
        s.phase='Settling beads · layer '+t+' / '+(n-1);const cap=n-1-t;
        for(let row=0;row<n;row++){set(row,Math.min(original[row],cap)+Math.max(0,t-n+row+1));if(row%128===0)yield;}
        yield;if(t===n-1)break;
      }
    }
    function* radix(){const buckets=Array.from({length:10},()=>[]);s.aux=new Int32Array(10);s.auxLabel='Digit buckets 0–9';
      for(let place=1;place<n;place*=10){s.phase='Collecting digit · '+place+'s place';for(let d=0;d<10;d++){buckets[d]=[];s.aux[d]=0;}
        for(let i=0;i<n;i++){const d=Math.floor(a[i]/place)%10;buckets[d].push(a[i]);s.aux[d]++;m.auxWrites++;mark(i);yield;}
        let pos=0;const starts=[];for(let d=0;d<10;d++){starts[d]=pos;pos+=buckets[d].length;}
        s.phase='Writing digit groups · '+place+'s place';const max=Math.max(...buckets.map(b=>b.length));
        for(let i=0;i<max;i++)for(let d=0;d<10;d++)if(i<buckets[d].length){set(starts[d]++,buckets[d][i]);yield;}
      }
    }
    function* shell(){for(let gap=Math.floor(n/2);gap>0;gap=Math.floor(gap/2)){s.phase='Insertion with gap '+gap;yield*insertion(0,n-1,gap);}}
    function* gnome(){let i=1;while(i<n){if(i===0){i=1;continue;}mark(i-1,i);if(cmp(a[i-1],a[i])<=0)i++;else{swap(i-1,i);i--;}yield;}}
    function* shaker(){let lo=0,hi=n-1,changed=true;while(changed&&lo<hi){changed=false;s.phase='Sweeping forward';for(let i=lo;i<hi;i++){mark(i,i+1);if(cmp(a[i],a[i+1])>0){swap(i,i+1);changed=true;}yield;}if(!changed)break;hi--;changed=false;s.phase='Sweeping backward';for(let i=hi;i>lo;i--){mark(i-1,i);if(cmp(a[i-1],a[i])>0){swap(i-1,i);changed=true;}yield;}lo++;}}
    function* bubble(){for(let end=n-1;end>0;end--){let changed=false;s.phase='Bubbling maximum to position '+end;for(let i=0;i<end;i++){mark(i,i+1);if(cmp(a[i],a[i+1])>0){swap(i,i+1);changed=true;}yield;}if(!changed)break;}}
    function* odd(){let changed=true;while(changed){changed=false;for(const parity of [1,0]){s.phase=parity?'Odd pairs':'Even pairs';for(let i=parity;i+1<n;i+=2){mark(i,i+1);if(cmp(a[i],a[i+1])>0){swap(i,i+1);changed=true;}yield;}}}}
    function* double(){for(let lo=0,hi=n-1;lo<hi;lo++,hi--){s.phase='Finding minimum and maximum';let min=lo,max=lo;for(let j=lo+1;j<=hi;j++){mark(j);if(cmp(a[j],a[min])<0)min=j;if(cmp(a[j],a[max])>0)max=j;yield;}swap(lo,min);yield;if(max===lo)max=min;swap(hi,max);yield;}}
    function* counting(){s.aux=new Int32Array(n);s.auxLabel='Occurrences per value';s.phase='Counting into auxiliary array';for(let i=0;i<n;i++){s.aux[a[i]]++;m.auxWrites++;mark(i);yield;}s.phase='Writing sorted values';let p=0;for(let v=0;v<n;v++){while(s.aux[v]>0){set(p++,v);s.aux[v]--;m.auxWrites++;yield;}}}
    function* selection(){for(let i=0;i<n-1;i++){s.phase='Finding next minimum';let min=i;for(let j=i+1;j<n;j++){mark(j,min);if(cmp(a[j],a[min])<0)min=j;yield;}swap(i,min);yield;}}
    function* cycle(){for(let start=0;start<n-1;start++){let item=a[start],pos=start;s.phase='Finding final position';for(let j=start+1;j<n;j++){mark(j);if(cmp(a[j],item)<0)pos++;yield;}if(pos===start)continue;
      let tmp=a[pos];set(pos,item);item=tmp;yield;
      while(pos!==start){pos=start;for(let j=start+1;j<n;j++){mark(j);if(cmp(a[j],item)<0)pos++;yield;}tmp=a[pos];set(pos,item);item=tmp;yield;}
    }}
    function* flag(){s.aux=new Int32Array(n);s.auxLabel='Remaining values per bucket';s.phase='Counting destination buckets';for(let i=0;i<n;i++){s.aux[a[i]]++;m.auxWrites++;mark(i);yield;}
      const start=new Int32Array(n);s.phase='Calculating bucket positions';for(let i=1;i<n;i++){start[i]=start[i-1]+s.aux[i-1];m.auxWrites++;yield;}
      s.phase='Following destination cycles';for(let b=0;b<n;b++){while(s.aux[b]>0){const origin=start[b];let from=origin,num=a[from];do{const to=start[num]++;s.aux[num]--;m.auxWrites+=2;const temp=a[to];set(to,num);num=temp;from=to;yield;}while(from!==origin);}}
    }
    function* tim(){s.phase='Insertion sorting 32-item runs';for(let lo=0;lo<n;lo+=32)yield*insertion(lo,Math.min(n-1,lo+31));for(let size=32;size<n;size*=2)for(let lo=0;lo<n;lo+=2*size){const mid=Math.min(lo+size-1,n-1),hi=Math.min(lo+2*size-1,n-1);if(mid<hi)yield*mergeParts(lo,mid,hi);}}
    const algorithms={merge,quick,heap,dual,comb,gravity,radix,shell,gnome,shaker,bubble,odd,double,insertion,counting,selection,bucket:counting,cycle,flag,tim};
    s.phase='Sorting';s.iterator=algorithms[id]();return s;
  }
  if(host){let run=null,token=0,computeMs=0,done=false;
    function snapshot(includeArray=true,silent=false){
      const bins=run.aux.length<=100?Array.from(run.aux):Array.from({length:100},(_,b)=>{const lo=Math.floor(b*run.aux.length/100),hi=Math.floor((b+1)*run.aux.length/100);let sum=0;for(let i=lo;i<hi;i++)sum+=run.aux[i];return sum/(hi-lo);});
      const msg={type:'frame',token,done,phase:done?'Complete':run.phase,metrics:{...run.metrics,computeMs},active:run.active,soundValue:!silent&&run.soundIndex>=0?run.a[run.soundIndex]:null,aux:bins,auxLength:run.aux.length,auxLabel:run.auxLabel};
      if(includeArray){msg.array=run.a.slice();host.postMessage(msg,[msg.array.buffer]);}else host.postMessage(msg);
    }
    host.onmessage=e=>{try{const q=e.data;if(q.type==='init'){token=q.token;run=create(q.algorithm,q.array);computeMs=0;done=false;snapshot();}
      else if(q.type==='tick'&&run&&q.token===token){const start=performance.now(),budget=Math.max(1,Math.min(q.budget||1,2000000)),limit=q.fast?30:12;let steps=0;
        run.soundIndex=-1;
        while(!done&&steps<budget){done=run.iterator.next().done;steps++;if(steps%128===0&&performance.now()-start>=limit)break;}
        computeMs+=performance.now()-start;snapshot(!q.fast||done,!!q.fast);
      }}catch(err){host.postMessage({type:'error',token,message:err.message});}};
  }
  return {ids,create};
}
if(typeof module!=='undefined')module.exports=SortingEngine;
