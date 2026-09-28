const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = fs.existsSync(__dirname + '/engine.js') ? require('./engine.js')() : {create:()=>{throw new Error('Sorting engine not implemented');}, ids:[]};
const ids = ['merge','quick','heap','dual','comb','gravity','radix','shell','gnome','shaker','bubble','odd','double','insertion','counting','selection','bucket','cycle','flag','tim'];
assert.deepEqual(engine.ids,ids,'All 20 algorithms must be available');
let count=0;
for (const id of ids) {
  const cases=[[],[0],[1,0],Array.from({length:40},(_,i)=>i),Array.from({length:40},(_,i)=>39-i)];
  for(let seed=1;seed<=8;seed++) {
    let r=seed, a=Array.from({length:37},(_,i)=>i);
    for(let i=a.length-1;i>0;i--) {r=(Math.imul(r,1664525)+1013904223)>>>0;const j=r%(i+1);[a[i],a[j]]=[a[j],a[i]];}
    cases.push(a);
  }
  for(const input of cases) {
    const run=engine.create(id,input), expected=[...input].sort((a,b)=>a-b);
    let steps=0;
    while(!run.iterator.next().done) assert.ok(++steps<1000000,`${id} must terminate`);
    assert.deepEqual(Array.from(run.a),expected,`${id} on ${input.slice(0,8)}`);
    assert.ok(Number.isFinite(run.metrics.comparisons));
    count++;
  }
}
assert.throws(()=>engine.create('missing',[1,0]),/algorithm/i);
assert.throws(()=>engine.create('merge',[0,0]),/permutation/i);
// A yielded checkpoint must permit an intermediate state, not eagerly finish the sort.
const paused=engine.create('bubble',[4,3,2,1,0]);paused.iterator.next();
assert.notDeepEqual(Array.from(paused.a),[0,1,2,3,4]);
// Counting visibly accumulates auxiliary data before rewriting the main array.
const counting=engine.create('counting',[2,0,1]);counting.iterator.next();
assert.deepEqual(Array.from(counting.a),[2,0,1]);
assert.equal(counting.aux.reduce((s,x)=>s+x,0),1);
console.log(`PASS: ${count} sorting cases across 20 algorithms, input validation, stepping, and auxiliary preparation.`);
for(const id of ['merge','quick','heap','dual','comb','gravity','radix','shell','counting','bucket','flag','tim']) {
 const a=Array.from({length:50000},(_,i)=>i);let r=4321;
 for(let i=a.length-1;i>0;i--){r=(Math.imul(r,1664525)+1013904223)>>>0;const j=r%(i+1);[a[i],a[j]]=[a[j],a[i]];}
 const run=engine.create(id,a);while(!run.iterator.next().done){}
 assert.ok(run.a.every((v,i)=>v===i),`${id}: 50,000 values must finish in order`);
}
let message;const host={postMessage:q=>message=q};require('./engine.js')(host);
host.onmessage({data:{type:'init',token:1,algorithm:'counting',array:[2,0,1]}});
assert.equal(message.done,false);
host.onmessage({data:{type:'tick',token:1,budget:1}});
assert.deepEqual(Array.from(message.array),[2,0,1]);assert.equal(message.metrics.auxWrites,1);
host.onmessage({data:{type:'tick',token:1,budget:100}});
assert.equal(message.done,true);assert.deepEqual(Array.from(message.array),[0,1,2]);
console.log('PASS: twelve 50,000-element runs and worker stepping/completion protocol.');
