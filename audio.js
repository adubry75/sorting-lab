/* Sorting Lab audio, AGPL-3.0. MIDI mapping adapted from CompilerStuck's
   MidiSys.java. The electric-piano voice is synthesized with Web Audio;
   no Java, MIDI device, soundfont download, or third-party runtime is required. */
function SortingAudio({createContext,onError=()=>{}}={}) {
  let context=null,master=null,wave=null,voice=null,enabled=true,volume=.35;
  function silence(){
    if(!voice||!context)return;
    const old=voice;voice=null;
    // A sub-millisecond taper avoids Web Audio discontinuity clicks while retaining
    // the original monophonic hard-retrigger character (no piano release tails).
    const now=context.currentTime;
    // A separate gate leaves the note's envelope automation intact. It also
    // avoids cancelAndHoldAtTime, which is unavailable in some browsers.
    old.gate.gain.setValueAtTime(1,now);
    old.gate.gain.linearRampToValueAtTime(0,now+.0008);
    old.osc.stop(now+.001);
  }
  function unlock(){
    if(!enabled)return Promise.resolve();
    try {
      if(!context){
        const make=createContext||(()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)());
        context=make();master=context.createGain();master.gain.value=volume;master.connect(context.destination);
        // Independently synthesized Rhodes-like spectrum. The 40 exponentially
        // diminishing harmonics and closing filter follow the character of the
        // JDK fallback Electric Piano 1, rather than a generic sine beep.
        const real=new Float32Array(41),imag=new Float32Array(41);
        let seed=302030201;
        for(let h=1;h<=40;h++){
          seed=(Math.imul(seed,1664525)+1013904223)>>>0;
          const phase=seed/4294967296*Math.PI*2,amplitude=Math.pow(.00005,(h-1)/40);
          real[h]=Math.cos(phase)*amplitude;imag[h]=Math.sin(phase)*amplitude;
        }
        wave=context.createPeriodicWave(real,imag);
      }
      return context.resume().catch(onError);
    }catch(error){onError(error);return Promise.resolve();}
  }
  function play(value,length,{step=false}={}){
    if(!enabled||volume===0||!context||context.state!=='running'||!Number.isInteger(value)||value<0||value>=length)return;
    silence();
    const now=context.currentTime,note=SortingAudio.noteFor(value,length),osc=context.createOscillator(),filter=context.createBiquadFilter(),gain=context.createGain(),gate=context.createGain();
    osc.setPeriodicWave(wave);osc.frequency.value=440*Math.pow(2,(note-69)/12);
    filter.type='lowpass';filter.Q.value=0;
    // SoundFont-style filter envelope: 16000 cents closes by 9000 cents in 4 s.
    const cutoff=cents=>Math.min(context.sampleRate*.45,8.176*Math.pow(2,cents/1200));
    filter.frequency.setValueAtTime(cutoff(16000),now);
    filter.frequency.exponentialRampToValueAtTime(cutoff(7000),now+4);
    const level=.22*Math.pow(90/127,2),hold=step?.18:8;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+.001);
    gain.gain.exponentialRampToValueAtTime(level*Math.pow(.00001,hold/101.594),now+hold);
    gain.gain.linearRampToValueAtTime(0,now+hold+.003);
    osc.connect(filter);filter.connect(gain);gain.connect(gate);gate.connect(master);
    const current={osc,filter,gain,gate};voice=current;
    osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect();gate.disconnect();if(voice===current)voice=null;};
    osc.start(now);osc.stop(now+hold+.004);
  }
  function setEnabled(value){enabled=!!value;if(!enabled)silence();}
  function setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(master)master.gain.setTargetAtTime(volume,context.currentTime,.01);if(!volume)silence();}
  function dispose(){silence();if(context)context.close().catch(()=>{});}
  return {unlock,play,silence,setEnabled,setVolume,dispose,get enabled(){return enabled;},get volume(){return volume;}};
}
SortingAudio.noteFor=(value,length)=>length>0?Math.max(0,Math.min(127,28+Math.floor(40*(value+1)/length))):28;
if(typeof module!=='undefined')module.exports={SortingAudio,noteFor:SortingAudio.noteFor};
