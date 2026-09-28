const assert=require('node:assert/strict');
let frame;
const host={postMessage:q=>frame=q};
require('./engine.js')(host);
const init=(algorithm,array)=>host.onmessage({data:{type:'init',token:7,algorithm,array}});
const tick=(budget=1,fast=false)=>host.onmessage({data:{type:'tick',token:7,budget,fast}});
init('counting',[2,0,1]);
assert.equal(frame.soundValue,null,'Initialization must not play a tone');
for(const value of [1,2,0]){tick();assert.equal(frame.soundValue,value,'Counting sounds highlighted positions during auxiliary preparation, as in the reference');}
tick();assert.equal(frame.soundValue,0,'First main-array write must sound the written value');
tick();assert.equal(frame.soundValue,1);
init('bubble',[1,0,2]);tick();
assert.equal(frame.soundValue,1,'A swap sounds the final value at the highest written index, matching the original drawing loop');
tick();assert.equal(frame.soundValue,2,'Search/comparison highlights also produce tones');
init('counting',[4,0,3,1,2]);tick(2);assert.equal(frame.soundValue,4,'The last highlighted position wins, not the largest index touched earlier in the batch');
init('counting',[2,0,1]);tick(100,true);
assert.equal(frame.soundValue,null,'Unanimated benchmarks must stay silent');
console.log('PASS: sound events follow current highlights, including auxiliary work; benchmarks are silent.');

const {noteFor}=require('./audio.js');
for(const [value,length,want] of [[0,50000,28],[1249,50000,29],[24999,50000,48],[49999,50000,68],[0,1,68],[0,0,28]]){
 assert.equal(noteFor(value,length),want,'Pitch must match the original integer MIDI mapping');
}
console.log('PASS: original MIDI pitch mapping, including boundaries and integer truncation.');
