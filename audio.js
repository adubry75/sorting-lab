/* Sorting Lab audio, AGPL-3.0. MIDI mapping adapted from CompilerStuck's
   MidiSys.java. Reference wavetables were fitted to the user's recording;
   no Java, MIDI device, soundfont download, or third-party runtime is required. */
function SortingAudio({createContext,onError=()=>{}}={}) {
  let context=null,master=null,mix=null,wave=null,referenceWaves=null,lfo=null,voice=null,enabled=true,volume=.70,bass=0,phaser=0,tone='reference';
  function silence(){
    if(!voice||!context)return;
    const old=voice;voice=null;
    // Fade rather than interrupting a waveform mid-cycle.
    const now=context.currentTime;
    // A separate gate leaves the note's envelope automation intact. It also
    // avoids cancelAndHoldAtTime, which is unavailable in some browsers.
    old.gate.gain.setValueAtTime(1,now);
    old.gate.gain.linearRampToValueAtTime(0,now+.008);
    old.osc.stop(now+.012);
    old.right.stop(now+.012);
    old.sub.stop(now+.012);
  }
  function unlock(){
    if(!enabled)return Promise.resolve();
    try {
      if(!context){
        const make=createContext||(()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)());
        context=make();master=context.createGain();master.gain.value=volume;master.connect(context.destination);
        // Keep the measured bass audible while removing DC and leaving headroom
        // when the optional effects are turned up. The limiter is linear below .8.
        mix=context.createBiquadFilter();mix.type='highpass';mix.frequency.value=20;mix.Q.value=Math.SQRT1_2;
        const limiter=context.createWaveShaper(),curve=new Float32Array(8193);
        for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.8?a:.8+.18*Math.tanh((a-.8)/.18));}
        limiter.curve=curve;limiter.oversample='2x';mix.connect(limiter);limiter.connect(master);
        // Mostly a sine, with a faint octave and third harmonic for warmth.
        // No dense upper spectrum, random phase, or sharp per-frame restarts.
        const real=new Float32Array(4),imag=new Float32Array([0,1,.09,.018]);
        wave=context.createPeriodicWave(real,imag);
        referenceWaves=SortingAudio.referenceTone.map(model=>model.real.map((r,c)=>context.createPeriodicWave(new Float32Array(r),new Float32Array(model.imag[c]),{disableNormalization:true})));
        // Slow modulation controls filter phase only; it is never audible itself.
        lfo=context.createOscillator();lfo.type='sine';lfo.frequency.value=.14;lfo.start();
      }
      return context.resume().catch(onError);
    }catch(error){onError(error);return Promise.resolve();}
  }
  function play(value,length,{step=false}={}){
    if(!enabled||volume===0||!context||context.state!=='running'||!Number.isInteger(value)||value<0||value>=length)return;
    const now=context.currentTime,note=SortingAudio.noteFor(value,length),frequency=440*Math.pow(2,(note-69)/12);
    const reference=tone==='reference',zone=note<=42?0:note<=56?1:2,divisor=reference?SortingAudio.referenceTone[zone].harmonic:1;
    // Carry the waveform's phase across highlights. Restarting it from zero on
    // each screen frame replaces low notes with a refresh-rate buzz.
    const previous=reference&&voice&&now<voice.endsAt?voice:null;
    const phase=previous?(previous.phase+(now-previous.startedAt)*previous.baseFrequency)%1:0;
    const subPhase=previous?(previous.subPhase+(now-previous.startedAt)*previous.pitchFrequency/2)%1:0;
    if(reference&&voice)silence();
    if(voice&&now>=voice.endsAt){silence();}
    if(!voice){
      const sub=context.createOscillator(),osc=context.createOscillator(),right=context.createOscillator(),stereo=context.createChannelMerger(2),gain=context.createGain(),gate=context.createGain();
      let pair=referenceWaves[zone];
      if(reference&&phase){
        const model=SortingAudio.referenceTone[zone];
        pair=model.real.map((re,c)=>{
          const real=new Float32Array(re.length),imag=new Float32Array(re.length);
          for(let h=0;h<re.length;h++){const angle=2*Math.PI*h*phase,cos=Math.cos(angle),sin=Math.sin(angle);real[h]=re[h]*cos+model.imag[c][h]*sin;imag[h]=model.imag[c][h]*cos-re[h]*sin;}
          return context.createPeriodicWave(real,imag,{disableNormalization:true});
        });
      }
      osc.setPeriodicWave(reference?pair[0]:wave);right.setPeriodicWave(reference?pair[1]:wave);
      osc.frequency.value=right.frequency.value=frequency/divisor;gain.gain.value=0;
      osc.connect(stereo,0,0);right.connect(stereo,0,1);
      const subLevel=context.createGain(),dry=context.createGain(),wet=context.createGain();
      sub.type='sine';sub.frequency.value=frequency/2;subLevel.gain.value=bass*.65;
      if(reference&&subPhase)sub.setPeriodicWave(context.createPeriodicWave(new Float32Array([0,Math.sin(2*Math.PI*subPhase)]),new Float32Array([0,Math.cos(2*Math.PI*subPhase)]),{disableNormalization:true}));
      dry.gain.value=1-phaser*.5;wet.gain.value=phaser*.5;
      // Mix a swept four-stage all-pass chain with the dry voice. The sub-bass
      // bypasses it so the bass stays solid as the upper voice moves.
      const filters=[],depths=[];let previous=stereo;
      for(const center of [180,270,405,607.5]){
        const filter=context.createBiquadFilter(),depth=context.createGain();
        filter.type='allpass';filter.frequency.value=center;filter.Q.value=.5;depth.gain.value=center*.72;
        lfo.connect(depth);depth.connect(filter.frequency);previous.connect(filter);previous=filter;
        filters.push(filter);depths.push(depth);
      }
      previous.connect(wet);wet.connect(gain);stereo.connect(dry);dry.connect(gain);
      sub.connect(subLevel);subLevel.connect(gain);gain.connect(gate);gate.connect(mix);
      const current={osc,right,stereo,sub,subLevel,dry,wet,gain,gate,filters,depths,note,phase,subPhase,baseFrequency:frequency/divisor,pitchFrequency:frequency,startedAt:now,endsAt:now};voice=current;
      osc.onended=()=>{osc.disconnect();right.disconnect();stereo.disconnect();sub.disconnect();subLevel.disconnect();dry.disconnect();wet.disconnect();gain.disconnect();gate.disconnect();for(const filter of filters)filter.disconnect();for(const depth of depths){lfo.disconnect(depth);depth.disconnect();}if(voice===current)voice=null;};
      osc.start(now);right.start(now);sub.start(now);
    }else if(voice.note!==note){
      // Keep oscillator phase continuous while approaching the same mapped pitch.
      voice.osc.frequency.setTargetAtTime(frequency,now,.018);voice.right.frequency.setTargetAtTime(frequency,now,.018);voice.sub.frequency.setTargetAtTime(frequency/2,now,.018);voice.note=note;
    }
    const level=reference?.55:.12,hold=step?.045:.08,release=step?.025:.05;
    voice.gain.gain.cancelScheduledValues(now);
    // Complement the old voice's eight-millisecond fade instead of overlapping
    // two full-level attacks. Stable notes retain complete bass cycles.
    if(reference){voice.gain.gain.setValueAtTime(0,now);voice.gain.gain.linearRampToValueAtTime(level,now+(previous?.008:.003));}
    else voice.gain.gain.setTargetAtTime(level,now,.014);
    voice.gain.gain.setTargetAtTime(0,now+hold,release);
    voice.endsAt=now+(step?.23:.55);
    // Replacing the scheduled stop extends this one voice while writes continue.
    voice.osc.stop(voice.endsAt);
    voice.right.stop(voice.endsAt);
    voice.sub.stop(voice.endsAt);
  }
  function setEnabled(value){enabled=!!value;if(!enabled)silence();}
  function setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(master)master.gain.setTargetAtTime(volume,context.currentTime,.01);if(!volume)silence();}
  function setBass(value){bass=Math.max(0,Math.min(1,Number(value)||0));if(voice)voice.subLevel.gain.setTargetAtTime(bass*.65,context.currentTime,.025);}
  function setPhaser(value){phaser=Math.max(0,Math.min(1,Number(value)||0));if(voice){voice.dry.gain.setTargetAtTime(1-phaser*.5,context.currentTime,.025);voice.wet.gain.setTargetAtTime(phaser*.5,context.currentTime,.025);}}
  function setTone(value){if(value!=='reference'&&value!=='soft')return;silence();tone=value;}
  function dispose(){silence();if(lfo)lfo.stop();if(context)context.close().catch(()=>{});}
  return {unlock,play,silence,setEnabled,setVolume,setBass,setPhaser,setTone,dispose,get enabled(){return enabled;},get volume(){return volume;},get bass(){return bass;},get phaser(){return phaser;},get tone(){return tone;}};
}
SortingAudio.noteFor=(value,length)=>length>0?Math.max(0,Math.min(127,28+Math.floor(40*(value+1)/length))):28;
SortingAudio.referenceTone=[{"label":"low","harmonic":2,"sourceFrequency":59.318,"real":[[0.0,0.0040548,-0.3741444,0.1384475,-0.0051399,0.1236445,-0.0010089,0.0584804,0.00719,0.0090673,0.008805,-0.0011203,-0.0015978,0.000278,0.0036413,0.0015588,0.0009264,0.0027221,8.21e-05,-0.0007382,0.0010939,0.0001291,-1.17e-05,0.0011849,-0.0001067,0.0016535,-0.0001576,0.0005224,0.0007002,0.0002715,-0.0011085,4.64e-05,0.0006466,-6.43e-05,-1.91e-05,0.0004861,0.0001464,-0.0002687,5.56e-05,9.95e-05,0.0001863,0.0001349,6.89e-05,2.8e-05,0.0002246,2.38e-05,-1.88e-05,4.97e-05,-5.91e-05,0.0001418,0.0001938,-9.63e-05,-9.48e-05,0.0002614,6.12e-05,-7.95e-05,6.5e-05,0.0003506,0.0001408,-9.4e-06,5.74e-05,6.9e-05,1.89e-05,-8.3e-06,4.55e-05],[0.0,0.001685,-0.6937023,0.0954146,-0.0021614,0.1370657,0.0021576,0.0591838,0.0031035,0.0046083,0.0158973,0.0008229,-0.0026194,-8.55e-05,0.0050641,0.0012933,0.0017457,0.0015025,0.0018971,-0.00111,0.0014519,0.0002987,0.0015871,2.82e-05,-9.67e-05,0.0011184,6.02e-05,0.0005979,0.000886,0.000304,-0.0009792,7.88e-05,0.0005235,-0.0002111,3.69e-05,0.0005707,0.0001398,-0.0003073,3.22e-05,6.8e-05,0.0001012,0.0002341,7.22e-05,-2.72e-05,0.0002368,4.43e-05,5.1e-06,5.86e-05,-1.12e-05,0.0001887,0.0002166,-5.8e-05,-2.6e-05,0.0002298,7.9e-05,-0.0001057,0.0001082,0.0004002,0.000102,3.9e-06,7.36e-05,9.7e-05,1.69e-05,1.79e-05,7.01e-05]],"imag":[[-0.0,-0.024756,-0.0672441,-0.0451445,0.0132369,-0.1913843,0.0052076,0.0172741,0.0011656,-0.0096246,-0.0048002,-0.0037883,-0.0056864,-0.0001331,0.0024722,-0.0014262,-0.0003991,-0.0001585,-0.0029361,0.0001184,-0.0016038,-0.0014823,-0.00101,-9.29e-05,-0.0003667,6.49e-05,0.0004076,-0.0011336,3.33e-05,0.0001659,-0.0003373,-0.000433,9.31e-05,0.0001931,-0.0004733,-0.0007663,-4.9e-06,7.2e-06,-0.0002219,-0.0003767,-0.0001312,-1.97e-05,-0.0003017,-0.0003795,-0.0001442,-0.0001064,-0.0001736,-0.0001448,-0.0001803,-0.0001651,-0.0001899,-0.0001198,-0.0003574,-0.0004257,-7.65e-05,-2.39e-05,-0.0003365,-0.0001945,0.0001069,-0.0001424,-0.0003048,-9.35e-05,3.33e-05,-0.0001161,-8.07e-05],[-0.0,-0.0151629,0.0062653,-0.0239688,0.0162837,-0.0996307,0.009447,0.0145262,0.002779,-0.0113857,0.0003231,-0.0012643,-0.0044016,0.0012338,0.0037531,0.0019199,0.0002856,-0.0002283,-0.0024512,0.000349,-0.0011453,-0.0009567,0.0006044,0.0004235,0.0006024,0.0008925,0.0007403,-0.0007186,0.0006889,0.0007732,0.0001449,6.51e-05,0.0006878,0.0006133,-0.0001735,-0.000299,0.0004181,0.0005961,0.0001832,5.98e-05,0.0003807,0.0001529,-0.0001287,2.8e-06,0.0001603,0.0002045,0.0001551,9.35e-05,0.0001055,0.0001843,0.0001207,0.0001678,7e-07,-0.0001069,0.0002174,0.000212,-9.49e-05,0.0001124,0.0003863,0.0001215,-6.65e-05,0.0001496,0.0002841,8.4e-05,0.0001316]]},{"label":"middle","harmonic":5,"sourceFrequency":147.2257,"real":[[0.0,0.003006,-0.0378434,0.0786179,0.0074055,-0.5168915,-0.0185753,0.1073395,-0.046741,0.0119993,-0.1104286,-0.0069859,-0.0096447,-0.0038779,-0.0135151,0.071216,0.0075395,-0.0738763,0.018435,-0.0080033,-0.0350057,-0.0045753,0.0082594,-0.0061371,0.0002058,-0.0060331,-0.0008559,-0.0021821,0.0001772,0.0001194,-0.0012834,-0.0005146,-0.00228,-0.0003503,-0.0009601,0.0016472,0.0008533,0.0022784,0.0011117,0.0007211,-0.0011416,-0.0006216,0.000305,-2.54e-05,0.0001191,-0.0004417,-0.0003344,-0.000911,-0.0007703,-0.0005465,-6.81e-05,0.0002703,0.0002956,0.0004325,0.0001383,0.0003962,-2.9e-06,0.0002607,2.31e-05,0.0001045,-3.61e-05,-0.000134,-0.0001109,-0.0004205,-0.0001247],[0.0,0.0027034,-0.056731,0.0626019,0.0037284,-0.458262,-0.0227488,0.1122299,-0.0491314,0.0121814,-0.1137187,-0.008401,-0.0035707,-0.0031726,-0.0170133,0.1135574,0.0088907,-0.0666066,0.0123272,-0.0057344,-0.0312477,-0.0063309,0.0066138,-0.0055925,0.0001699,-0.0050497,-0.0008214,-0.0027103,-0.0001447,-7.1e-06,-0.0012114,-0.000708,-0.0028017,-0.0003386,-0.0010848,0.0016895,0.0007369,0.0024302,0.0009273,0.00063,-0.0010405,-0.000325,0.0010448,7.07e-05,8e-05,-0.0004314,-0.0003188,-0.0010246,-0.0007199,-0.0004563,-0.0001588,0.0002828,0.0003159,0.0004138,0.0001066,0.000444,-2.12e-05,0.000278,2.9e-06,0.0001616,3.1e-06,-0.0001414,-0.0001408,-0.0005263,-0.0001659]],"imag":[[-0.0,-0.0003865,-0.0274156,0.0051879,-0.0108696,0.116736,0.0044268,-0.0556667,0.0411404,-0.0037052,-0.0385182,-0.0059649,0.015489,-0.0123439,-0.0054473,0.1403921,0.0184419,-0.043265,0.0126258,-0.0059456,0.0552618,0.0109528,-0.0254372,0.0035865,0.0025669,-0.0016963,-0.0002575,-0.0036181,0.0011569,-0.0011089,0.0036708,0.0012988,0.0040268,0.0006582,0.001047,0.0005963,0.0005649,0.0013564,0.0005257,0.000951,-0.0010254,-0.0002162,-0.0014394,-0.0006116,1.64e-05,0.0002038,0.0005613,0.0005869,0.0007991,0.0004594,0.0007361,0.0003806,0.0008266,0.000481,0.0005487,0.0003466,0.0001014,-4.6e-06,-0.0003025,6.33e-05,-0.0002524,0.0003064,4.53e-05,0.0004761,0.0001585],[-0.0,-0.0031596,-0.0510203,0.0066462,-0.0138323,-0.0781679,0.004485,-0.0642599,0.0402545,-0.004135,-0.0513814,-0.006184,0.0105855,-0.010438,-0.0068029,0.1731522,0.0200855,-0.0338508,0.0134262,-0.0041954,0.0662985,0.0110222,-0.0262978,0.0040387,0.0025484,-0.0013692,0.0002832,-0.0042775,0.0012894,-0.0006624,0.0038051,0.0015109,0.0027708,0.0011161,0.0009282,0.0007379,0.0007295,0.0018704,0.0007203,0.0010554,-0.0007754,2.62e-05,-0.0023946,-0.0006973,9.86e-05,0.0003709,0.0007701,0.000691,0.0007972,0.000482,0.0008253,0.0005126,0.0008738,0.0006995,0.0007684,0.0004919,5.9e-05,6.12e-05,-0.000302,0.0001437,-0.0001064,0.0004262,0.0001549,0.0004891,0.0002679]]},{"label":"high","harmonic":10,"sourceFrequency":294.8255,"real":[[0.0,0.000542,-0.0115938,0.0234397,0.0016948,0.0477426,-0.0029067,0.051859,-0.0541535,0.0078968,0.2292171,-0.0294491,0.033668,-0.0266252,-0.0036159,-0.0336118,0.0042874,-0.0279665,0.0284405,-0.0002047,-0.052093,0.0031122,0.0098249,-0.004727,0.0008925,-0.0171592,0.0028246,-0.0170247,0.0139871,0.0072693,0.0043078,0.0143792,-0.0340113,0.0155718,-0.0042166,0.0163746,-0.0033033,0.0103504,-0.017755,-0.0035823,0.0058825,-0.0028602,0.0019829,-0.0029222,-0.0003032,-0.0033466,0.0006387,-0.0012962,0.0012772,0.0004478,0.001867,-2.8e-06,0.000694,-0.0008494,-0.000319,-0.0006306,-0.0001547,-0.0008136,0.0007568,5.86e-05,0.0003854,0.0001091,0.0004121,-0.0006842,6.83e-05],[0.0,0.0011013,-0.0269534,0.0176686,0.0004066,0.0371865,-0.0045129,0.0609291,-0.056197,-0.00281,0.324557,-0.0291749,0.0409514,-0.0365549,-0.0011237,-0.0436626,0.0058177,-0.020658,0.0216395,0.0025882,-0.0374933,0.0039205,0.0101728,-0.0034235,0.0010293,-0.0145687,0.0035154,-0.0201968,0.018595,0.0074223,-0.0028993,0.0141579,-0.0241983,0.0180228,-0.0042563,0.0169917,-0.0042826,0.0111493,-0.01357,-0.0030578,0.0083394,-0.0018838,0.0038787,-0.0030238,-9.66e-05,-0.00319,0.0006657,-0.0011177,0.0011845,0.0006661,0.0015522,-6.32e-05,0.0007796,-0.0005126,-0.0003045,-0.0007637,3.6e-05,-0.0007794,0.0006964,7.78e-05,0.0004494,0.0001508,0.0004488,-0.0005119,0.0001141]],"imag":[[-0.0,-0.0019228,-0.0007794,-0.0002565,-0.0026624,0.0148153,0.0047827,0.0009386,0.0139658,-0.0049257,-0.4919287,-0.0150112,0.0762166,-0.0248297,0.0038182,-0.0263551,0.0002848,-0.0177243,0.0035287,0.0035915,0.0738724,0.0054374,-0.0093342,0.0037537,0.0009837,-0.0002621,-0.0015762,0.0067971,-0.0137749,0.00958,0.190234,0.0064373,-0.0270649,-0.0069972,-0.0022381,-0.0069155,0.0013426,-0.0020834,0.0062849,-0.0070869,-0.0688377,-0.0045454,0.0144846,-0.0041969,0.0011557,-0.0046789,0.0002456,-0.0019959,0.0026569,4.44e-05,0.0035769,-0.0003294,0.0022942,-0.0017059,-0.0002651,-0.0026216,0.0001491,-0.0019545,0.0012001,0.0003789,0.002612,-0.0002617,0.0016252,-0.0015661,-0.0002792],[-0.0,-0.0028573,-0.001398,0.004506,-0.0024109,0.0281375,0.0042788,-0.0035063,0.0147892,0.0018762,-0.4872781,-0.0143679,0.0515424,-0.0291162,0.0038025,-0.0263095,0.0015,-0.0135065,0.0116068,0.0025178,0.0863323,0.0063374,-0.0086392,0.0034603,0.0009529,-0.0008001,-0.0015234,0.0072525,-0.0180341,0.0063752,0.1868222,0.0024671,-0.0280596,-0.0049394,-0.0033636,-0.0063745,0.000164,-0.0033398,0.0090928,-0.0064042,-0.0664851,-0.0037705,0.0221759,-0.0060397,0.0010179,-0.0047496,0.0001345,-0.0025853,0.0024788,-8.99e-05,0.0032671,-0.0005741,0.0018898,-0.0014801,-0.0002663,-0.0032404,0.0003594,-0.0018195,0.0016131,0.0002662,0.0026481,-0.0002209,0.0017436,-0.0015835,-0.0002661]]}];
if(typeof module!=='undefined')module.exports={SortingAudio,noteFor:SortingAudio.noteFor};
